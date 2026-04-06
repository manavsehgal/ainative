"use client";

import Link from "next/link";
import { TrendingUp, Trophy, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TIER_PRICING } from "@/lib/license/tier-limits";

function ValueProp({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof TrendingUp;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg border bg-background">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold tracking-tight">{title}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground pl-9">
        {description}
      </p>
    </div>
  );
}

/**
 * Analytics-specific upgrade CTA card.
 * Replaces the generic PremiumGateOverlay lock card with
 * benefit-oriented messaging and value props.
 */
export function AnalyticsGateCard() {
  const price = TIER_PRICING.operator.monthly;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="surface-card rounded-xl border shadow-lg p-8 space-y-6">
        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <Badge variant="secondary" className="text-[10px] font-medium tracking-wide uppercase">
              Operator Feature
            </Badge>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            See what your AI agents are worth
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Turn raw execution data into actionable ROI insights
          </p>
        </div>

        {/* Value Props */}
        <div className="space-y-4 py-2">
          <ValueProp
            icon={TrendingUp}
            title="ROI Tracking"
            description="Know exactly how much time and money your agents save with automated value calculations"
          />
          <ValueProp
            icon={Trophy}
            title="Profile Leaderboard"
            description="See which agent profiles deliver the best results and optimize your team"
          />
          <ValueProp
            icon={Coins}
            title="Cost Efficiency"
            description="Track cost-per-outcome trends to find the sweet spot between quality and spend"
          />
        </div>

        {/* Pricing + CTA */}
        <div className="space-y-3 pt-2">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl font-bold">${price}</span>
            <span className="text-xs text-muted-foreground">/mo</span>
            <span className="text-xs text-muted-foreground mx-1">·</span>
            <span className="text-xs text-muted-foreground">Operator tier</span>
          </div>
          <Button className="w-full" size="lg" asChild>
            <Link href="/settings?highlight=operator">
              Unlock Analytics
            </Link>
          </Button>
        </div>

        {/* Social proof / objection handler */}
        <p className="text-[11px] text-center text-muted-foreground">
          Derived from data you already have — zero setup required
        </p>
      </div>
    </div>
  );
}
