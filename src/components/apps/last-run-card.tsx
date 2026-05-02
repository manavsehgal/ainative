import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/constants/task-status";

interface LastRunSummary {
  id: string;
  status: TaskStatus;
  createdAt: number;
}

interface LastRunCardProps {
  blueprintId: string;
  blueprintLabel: string;
  lastRun: LastRunSummary | null;
  runCount30d: number;
}

const statusVariant: Record<
  TaskStatus,
  "default" | "success" | "secondary" | "destructive" | "outline"
> = {
  running: "default",
  completed: "success",
  queued: "secondary",
  failed: "destructive",
  planned: "outline",
  cancelled: "outline",
};

/**
 * Compact card surfacing one blueprint's last-run state. Used by the
 * Workflow Hub kit's `secondary` slot (one card per blueprint). Hero variant
 * (markdown body) is deferred to Coach/Research kits in later phases.
 */
export function LastRunCard({
  blueprintLabel,
  lastRun,
  runCount30d,
}: LastRunCardProps) {
  return (
    <Card className="surface-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {blueprintLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lastRun ? (
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[lastRun.status]}>
              {lastRun.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatAgo(lastRun.createdAt)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">never run</p>
        )}
        <p className="text-xs text-muted-foreground">
          {runCount30d} {runCount30d === 1 ? "run" : "runs"} · last 30d
        </p>
      </CardContent>
    </Card>
  );
}

function formatAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
