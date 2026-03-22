"use client";

import { Check, AlertTriangle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillDriftIndicatorProps {
  status: "synced" | "drifted" | "one-sided";
  className?: string;
}

const CONFIG = {
  synced: {
    icon: Check,
    label: "Synced",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  drifted: {
    icon: AlertTriangle,
    label: "Drifted",
    className: "text-amber-600 dark:text-amber-400",
  },
  "one-sided": {
    icon: Minus,
    label: "Single",
    className: "text-muted-foreground",
  },
};

export function SkillDriftIndicator({ status, className }: SkillDriftIndicatorProps) {
  const config = CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn("flex items-center gap-1 text-[10px] font-medium", config.className, className)}
      title={config.label}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
