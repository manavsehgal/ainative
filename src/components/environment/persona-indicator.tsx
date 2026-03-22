"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PersonaIndicatorProps {
  tool: string;
  size?: "sm" | "md";
  className?: string;
}

const TOOL_CONFIG: Record<string, { label: string; className: string }> = {
  "claude-code": {
    label: "Claude",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  },
  codex: {
    label: "Codex",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  shared: {
    label: "Shared",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
};

export function PersonaIndicator({ tool, size = "sm", className }: PersonaIndicatorProps) {
  const config = TOOL_CONFIG[tool] || { label: tool, className: "" };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
