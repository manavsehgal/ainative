"use client";

import { useEffect, useState, useCallback } from "react";
import { Crown, BarChart3, Brain, Calendar, Zap, ExternalLink, TrendingUp, Cloud, Store } from "lucide-react";
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
import { TIER_LABELS, TIER_PRICING, type LicenseTier } from "@/lib/license/tier-limits";
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

const USAGE_HINTS: Record<string, { sub: string; atLimit: string }> = {
  agentMemories: {
    sub: "Cumulative per profile. New writes blocked at limit — existing memories preserved.",
    atLimit: "At capacity — archive old memories or upgrade to continue learning.",
  },
  contextVersions: {
    sub: "Cumulative per profile. New proposals blocked at limit — existing versions preserved.",
    atLimit: "At capacity — upgrade to unlock more self-improvement cycles.",
  },
  activeSchedules: {
    sub: "Concurrent active schedules. Pausing a schedule frees a slot.",
    atLimit: "All slots used — pause an existing schedule or upgrade for more.",
  },
  parallelWorkflows: {
    sub: "Concurrent running workflows. Slots free when tasks complete.",
    atLimit: "All slots busy — wait for a task to finish or upgrade.",
  },
};

function UsageCard({
  icon: Icon,
  label,
  current,
  limit,
  resourceKey,
}: {
  icon: typeof Brain;
  label: string;
  current: number;
  limit: number;
  resourceKey: string;
}) {
  const isUnlimited = limit === -1;
  const ratio = isUnlimited ? 0 : (current / limit) * 100;
  const isWarning = !isUnlimited && ratio >= 80;
  const isBlocked = !isUnlimited && ratio >= 100;
  const hints = USAGE_HINTS[resourceKey];

  return (
    <div className="surface-card-muted rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className={`text-xs ${isBlocked ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {current} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={Math.min(ratio, 100)}
          className={`h-1.5 ${isBlocked ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-amber-500" : ""}`}
        />
      )}
      {hints && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {isBlocked ? hints.atLimit : hints.sub}
        </p>
      )}
    </div>
  );
}

function TierBenefit({ icon: Icon, text }: { icon: typeof Brain; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-primary shrink-0" />
      <span className="text-[11px] text-muted-foreground">{text}</span>
    </li>
  );
}

export function SubscriptionSection() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

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
        body: JSON.stringify({ tier: targetTier, billingPeriod }),
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
          {isPremium && license?.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/license/portal?email=${encodeURIComponent(license.email)}`} target="_blank" rel="noopener">
                Manage Billing <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>

        {/* Usage Summary */}
        {usage && (
          <div className="grid grid-cols-2 gap-3">
            <UsageCard icon={Brain} label="Agent Memories" current={usage.agentMemories.current} limit={usage.agentMemories.limit} resourceKey="agentMemories" />
            <UsageCard icon={BarChart3} label="Context Versions" current={usage.contextVersions.current} limit={usage.contextVersions.limit} resourceKey="contextVersions" />
            <UsageCard icon={Calendar} label="Active Schedules" current={usage.activeSchedules.current} limit={usage.activeSchedules.limit} resourceKey="activeSchedules" />
            <UsageCard icon={Zap} label="Parallel Workflows" current={usage.parallelWorkflows.current} limit={usage.parallelWorkflows.limit} resourceKey="parallelWorkflows" />
          </div>
        )}

        {/* Tier Comparison */}
        {!isPremium && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Upgrade your plan</h4>
              <div className="flex items-center gap-1 rounded-lg border p-0.5">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${billingPeriod === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setBillingPeriod("monthly")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${billingPeriod === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setBillingPeriod("annual")}
                >
                  Annual
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Solo */}
              <div className="surface-card-muted rounded-lg p-4 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-sm font-semibold">Solo</span>
                    <p className="text-lg font-bold mt-1">
                      ${TIER_PRICING.solo[billingPeriod]}
                      <span className="text-xs font-normal text-muted-foreground">
                        {billingPeriod === "monthly" ? "/mo" : "/yr"}
                      </span>
                    </p>
                    {billingPeriod === "annual" && (
                      <p className="text-[10px] text-primary font-medium mt-0.5">
                        Save ${TIER_PRICING.solo.monthly * 12 - TIER_PRICING.solo.annual}/yr
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    For power users who need room to grow. 4x the memory, longer history, and marketplace access.
                  </p>
                  <ul className="space-y-1">
                    <TierBenefit icon={Brain} text="200 memories per profile" />
                    <TierBenefit icon={Calendar} text="20 active schedules" />
                    <TierBenefit icon={Store} text="Import marketplace blueprints" />
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-4"
                  disabled={checkoutLoading}
                  onClick={() => handleUpgrade("solo")}
                >
                  {checkoutLoading ? "Loading..." : "Get Solo"}
                </Button>
              </div>

              {/* Operator */}
              <div className="surface-card-muted rounded-lg p-4 flex flex-col ring-1 ring-primary/30">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Operator</span>
                    <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                  </div>
                  <p className="text-lg font-bold">
                    ${TIER_PRICING.operator[billingPeriod]}
                    <span className="text-xs font-normal text-muted-foreground">
                      {billingPeriod === "monthly" ? "/mo" : "/yr"}
                    </span>
                  </p>
                  {billingPeriod === "annual" && (
                    <p className="text-[10px] text-primary font-medium">
                      Save ${TIER_PRICING.operator.monthly * 12 - TIER_PRICING.operator.annual}/yr
                    </p>
                  )}
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    For professionals who run AI at scale. Full analytics, cloud sync, and marketplace publishing.
                  </p>
                  <ul className="space-y-1">
                    <TierBenefit icon={TrendingUp} text="ROI analytics dashboard" />
                    <TierBenefit icon={Cloud} text="Encrypted cloud sync" />
                    <TierBenefit icon={Store} text="Publish to marketplace" />
                    <TierBenefit icon={Brain} text="500 memories per profile" />
                  </ul>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-4"
                  disabled={checkoutLoading}
                  onClick={() => handleUpgrade("operator")}
                >
                  {checkoutLoading ? "Loading..." : "Get Operator"}
                </Button>
              </div>

              {/* Scale */}
              <div className="surface-card-muted rounded-lg p-4 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div>
                    <span className="text-sm font-semibold">Scale</span>
                    <p className="text-lg font-bold mt-1">
                      ${TIER_PRICING.scale[billingPeriod]}
                      <span className="text-xs font-normal text-muted-foreground">
                        {billingPeriod === "monthly" ? "/mo" : "/yr"}
                      </span>
                    </p>
                    {billingPeriod === "annual" && (
                      <p className="text-[10px] text-primary font-medium mt-0.5">
                        Save ${TIER_PRICING.scale.monthly * 12 - TIER_PRICING.scale.annual}/yr
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    No limits, no compromises. Unlimited everything with featured marketplace placement.
                  </p>
                  <ul className="space-y-1">
                    <TierBenefit icon={Zap} text="Unlimited memories & schedules" />
                    <TierBenefit icon={Store} text="Featured marketplace listings" />
                    <TierBenefit icon={Calendar} text="Unlimited history retention" />
                  </ul>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-4"
                  disabled={checkoutLoading}
                  onClick={() => handleUpgrade("scale")}
                >
                  {checkoutLoading ? "Loading..." : "Get Scale"}
                </Button>
              </div>
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
