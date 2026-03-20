"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  ShieldCheck,
  Wallet,
  Cpu,
  User,
  Bot,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/shared/status-chip";
import type { TaskProvenance, ProvenanceEntry } from "@/lib/agents/provenance";

interface BehaviorExplainerProps {
  taskId: string;
}

/**
 * BehaviorExplainer — structured provenance panel for AI task actions.
 *
 * Shows: initiator, profile, runtime, tool call timeline, approvals, cost, outcome.
 * Fetches data from GET /api/tasks/[id]/provenance.
 */
export function BehaviorExplainer({ taskId }: BehaviorExplainerProps) {
  const [data, setData] = useState<TaskProvenance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/provenance`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-48" />
        <div className="h-3 bg-muted rounded w-32" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        No provenance data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={User}
          label="Initiator"
          value={data.initiator}
        />
        <MetricCard
          icon={Bot}
          label="Profile"
          value={data.agentProfile ?? "Auto"}
        />
        <MetricCard
          icon={Cpu}
          label="Runtime"
          value={data.runtime ?? "Default"}
        />
        <MetricCard
          icon={Wallet}
          label="Cost"
          value={`$${data.totalCost.toFixed(4)}`}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {data.toolCallCount} tool calls
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          {data.approvalCount} approvals
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {data.timeline.length} events
        </span>
        <StatusChip status={data.taskStatus} />
      </div>

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h4>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {data.timeline.slice(0, 50).map((entry, i) => (
              <TimelineEntry key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card-muted rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}

const typeColors: Record<string, string> = {
  log: "bg-status-running",
  approval: "bg-status-warning",
  cost: "bg-primary",
};

function TimelineEntry({ entry }: { entry: ProvenanceEntry }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div
        className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${typeColors[entry.type] ?? "bg-muted-foreground"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{entry.event}</span>
          {entry.status && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {entry.status}
            </Badge>
          )}
        </div>
        {entry.detail && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {entry.detail}
          </p>
        )}
      </div>
      <time className="text-[10px] text-muted-foreground shrink-0" suppressHydrationWarning>
        {new Date(entry.timestamp).toLocaleTimeString()}
      </time>
    </div>
  );
}
