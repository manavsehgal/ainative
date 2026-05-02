"use client";

import { Badge } from "@/components/ui/badge";
import type { RuntimeTaskSummary } from "@/lib/apps/view-kits/types";

interface RunHistoryStripProps {
  runs: RuntimeTaskSummary[];
  onSelect?: (run: RuntimeTaskSummary) => void;
}

export function RunHistoryStrip({ runs, onSelect }: RunHistoryStripProps) {
  if (runs.length === 0) {
    return <div className="text-xs text-muted-foreground p-4">No runs yet</div>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {runs.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onSelect?.(r)}
          className="surface-card rounded-lg p-3 min-w-[180px] text-left hover:bg-accent focus-visible:ring-2 ring-ring border"
        >
          <div className="text-xs font-medium truncate">{r.title}</div>
          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString()}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
