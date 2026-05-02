import { CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import type { TimelineRun } from "@/lib/apps/view-kits/types";

interface RunHistoryTimelineProps {
  runs: TimelineRun[];
  onSelect?: (runId: string) => void;
  emptyHint?: string;
}

const STATUS_ICON: Record<TimelineRun["status"], typeof CheckCircle2> = {
  completed: CheckCircle2,
  failed: AlertTriangle,
  running: Loader2,
  queued: Clock,
};

const STATUS_COLOR: Record<TimelineRun["status"], string> = {
  completed: "text-emerald-600",
  failed: "text-destructive",
  running: "text-primary",
  queued: "text-muted-foreground",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

export function RunHistoryTimeline({
  runs,
  onSelect,
  emptyHint,
}: RunHistoryTimelineProps) {
  if (runs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">
        {emptyHint ?? "No runs yet"}
      </div>
    );
  }

  return (
    <ol className="space-y-2" role="list">
      {runs.map((run) => {
        const Icon = STATUS_ICON[run.status];
        const colorClass = STATUS_COLOR[run.status];
        const inner = (
          <span className="flex items-center gap-3 w-full text-left">
            <Icon
              className={`h-4 w-4 shrink-0 ${colorClass} ${
                run.status === "running" ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">
              <span className="text-xs text-muted-foreground capitalize">
                {run.status}
              </span>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatRelative(run.startedAt)}
            </span>
            {run.durationMs !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDuration(run.durationMs)}
              </span>
            )}
          </span>
        );

        return (
          <li
            key={run.id}
            role="listitem"
            className="border rounded-lg p-2"
            data-run-id={run.id}
            data-run-status={run.status}
          >
            {onSelect ? (
              <button
                type="button"
                className="w-full"
                onClick={() => onSelect(run.id)}
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
