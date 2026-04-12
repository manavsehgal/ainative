"use client";

import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import type { AppTrustLevel } from "@/lib/apps/types";

const TRUST_CONFIG: Record<
  AppTrustLevel,
  { icon: typeof Shield; color: string; label: string }
> = {
  official: { icon: ShieldCheck, color: "text-amber-500", label: "Official" },
  verified: { icon: ShieldCheck, color: "text-emerald-500", label: "Verified" },
  community: { icon: Shield, color: "text-blue-500", label: "Community" },
  private: { icon: ShieldAlert, color: "text-muted-foreground", label: "Private" },
};

export function TrustBadge({ level }: { level: AppTrustLevel }) {
  const config = TRUST_CONFIG[level] ?? TRUST_CONFIG.community;
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1 ${config.color}`} title={config.label}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[10px] font-medium uppercase tracking-wide">
        {config.label}
      </span>
    </div>
  );
}
