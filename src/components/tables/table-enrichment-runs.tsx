"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { workflowStatusVariant } from "@/lib/constants/status-colors";

interface EnrichmentRunSummary {
  workflowId: string;
  name: string;
  status: string;
  updatedAt: string;
  targetColumn: string;
  targetColumnLabel: string;
  rowCount: number;
  strategy:
    | "single-pass-lookup"
    | "single-pass-classify"
    | "research-and-synthesize";
  promptMode: "auto" | "custom";
}

interface TableEnrichmentRunsProps {
  tableId: string;
  refreshKey?: number;
}

export function TableEnrichmentRuns({
  tableId,
  refreshKey = 0,
}: TableEnrichmentRunsProps) {
  const [runs, setRuns] = useState<EnrichmentRunSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/enrich/runs?limit=5`);
      if (!res.ok) throw new Error("Failed to load runs");
      const data = (await res.json()) as EnrichmentRunSummary[];
      setRuns(data);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns, refreshKey]);

  if (!loading && runs.length === 0) {
    return null;
  }

  return (
    <section className="surface-card-muted rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Recent Enrichments</h3>
          <p className="text-xs text-muted-foreground">
            Recent planner-driven enrichment runs for this table.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRuns}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading recent enrichment runs…</p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.workflowId}
              className="surface-control rounded-lg border px-3 py-2 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{run.targetColumnLabel}</p>
                  <Badge variant={workflowStatusVariant[run.status] ?? "outline"}>
                    {run.status}
                  </Badge>
                  <Badge variant="outline">{run.promptMode}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {run.rowCount} rows · {run.strategy} ·{" "}
                  {new Date(run.updatedAt).toLocaleString()}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/workflows/${run.workflowId}`}>View</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
