"use client";

import { getReadingPath } from "@/lib/book/reading-paths";

interface PathProgressProps {
  pathId: string;
  progress: Record<string, { progress: number }>;
}

export function PathProgress({ pathId, progress }: PathProgressProps) {
  const path = getReadingPath(pathId);
  if (!path) return null;

  const completedCount = path.chapterIds.filter(
    (chId) => (progress[chId]?.progress ?? 0) >= 0.9
  ).length;
  const totalCount = path.chapterIds.length;
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {completedCount} of {totalCount} chapters
      </span>
    </div>
  );
}
