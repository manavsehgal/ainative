"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_LABELS, type LicenseTier } from "@/lib/license/tier-limits";

interface PremiumGateOverlayProps {
  feature: string;
  requiredTier: LicenseTier;
  children: React.ReactNode;
  className?: string;
}

/**
 * Content-fade overlay for Community users viewing premium features.
 * Shows blurred/faded content with a lock card and upgrade CTA.
 */
export function PremiumGateOverlay({
  feature,
  requiredTier,
  children,
  className,
}: PremiumGateOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Faded content */}
      <div className="opacity-30 pointer-events-none select-none blur-[2px]" aria-hidden>
        {children}
      </div>

      {/* Lock card */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="surface-card-muted rounded-lg border p-6 text-center space-y-3 max-w-sm shadow-lg">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-medium">{feature}</h3>
          <p className="text-xs text-muted-foreground">
            This feature requires the {TIER_LABELS[requiredTier]} tier or above.
          </p>
          <Button size="sm" asChild>
            <Link href={`/settings?highlight=${requiredTier}`}>
              Upgrade to {TIER_LABELS[requiredTier]}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
