"use client";

import { cn } from "@/lib/utils";

interface ArtifactPresenceCellProps {
  count: number;
  median: number;
  hasData: boolean;
}

export function ArtifactPresenceCell({
  count,
  median,
  hasData,
}: ArtifactPresenceCellProps) {
  if (!hasData) {
    return (
      <div className="w-full h-8 rounded bg-muted/30 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground">—</span>
      </div>
    );
  }

  // Color coding: green (above median), yellow (at median), red (zero)
  const colorClass =
    count === 0
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
      : count > median
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        : count === median
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-amber-50/50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400";

  return (
    <div
      className={cn(
        "w-full h-8 rounded flex items-center justify-center text-xs font-medium",
        colorClass
      )}
    >
      {count}
    </div>
  );
}
