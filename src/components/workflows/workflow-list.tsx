"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowCreateDialog } from "./workflow-create-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { GitBranch } from "lucide-react";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";

interface Workflow {
  id: string;
  name: string;
  status: string;
  projectId: string | null;
  definition: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowListProps {
  projects: { id: string; name: string }[];
}


export function WorkflowList({ projects }: WorkflowListProps) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workflows");
    if (res.ok) setWorkflows(await res.json());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function getPattern(definitionJson: string): string {
    try {
      const def = JSON.parse(definitionJson);
      return def.pattern ?? "unknown";
    } catch {
      return "unknown";
    }
  }

  function getStepCount(definitionJson: string): number {
    try {
      const def = JSON.parse(definitionJson);
      return def.steps?.length ?? 0;
    } catch {
      return 0;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workflows</h1>
        <WorkflowCreateDialog projects={projects} onCreated={refresh} />
      </div>

      {!loaded ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-live="polite">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          heading="No workflows yet"
          description="Create a workflow to chain agent tasks together."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => {
            const pattern = getPattern(wf.definition);
            const stepCount = getStepCount(wf.definition);
            return (
              <Card
                key={wf.id}
                tabIndex={0}
                className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
                onClick={() => router.push(`/workflows/${wf.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/workflows/${wf.id}`); } }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">{wf.name}</CardTitle>
                    <Badge variant={workflowStatusVariant[wf.status] ?? "secondary"}>
                      {wf.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{patternLabels[pattern] ?? pattern}</span>
                    <span>·</span>
                    <span>{stepCount} step{stepCount !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
