"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Circle, Loader2, XCircle, ShieldQuestion, Play } from "lucide-react";
import { toast } from "sonner";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";

interface StepWithState {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;
  state: {
    stepId: string;
    status: string;
    taskId?: string;
    result?: string;
    error?: string;
  };
}

interface WorkflowStatusData {
  id: string;
  name: string;
  status: string;
  pattern: string;
  steps: StepWithState[];
}

interface WorkflowStatusViewProps {
  workflowId: string;
}

const stepStatusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  waiting_approval: <ShieldQuestion className="h-4 w-4 text-amber-500" />,
};


export function WorkflowStatusView({ workflowId }: WorkflowStatusViewProps) {
  const [data, setData] = useState<WorkflowStatusData | null>(null);
  const [executing, setExecuting] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/workflows/${workflowId}/status`);
    if (res.ok) setData(await res.json());
  }, [workflowId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function startExecution() {
    setExecuting(true);
    // I5: Optimistic update — immediately show "active" status
    if (data) {
      setData({
        ...data,
        status: "active",
        steps: data.steps.map((s, i) =>
          i === 0 ? { ...s, state: { ...s.state, status: "running" } } : s
        ),
      });
    }
    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Workflow started");
        fetchStatus();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Failed to start workflow");
        fetchStatus(); // Revert optimistic update on failure
      }
    } finally {
      setExecuting(false);
    }
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{data.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {patternLabels[data.pattern] ?? data.pattern}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={workflowStatusVariant[data.status] ?? "secondary"}>
              {data.status}
            </Badge>
            {(data.status === "draft" || data.status === "paused") && (
              <Button size="sm" onClick={startExecution} disabled={executing}>
                <Play className="h-3 w-3 mr-1" />
                {executing ? "Starting..." : "Execute"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" aria-live="polite">
          {data.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex flex-col items-center">
                {stepStatusIcons[step.state.status] ?? stepStatusIcons.pending}
                {index < data.steps.length - 1 && (
                  <div className="w-px h-6 bg-border mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{step.name}</span>
                  {step.requiresApproval && (
                    <Badge variant="outline" className="text-xs">checkpoint</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {step.prompt.slice(0, 100)}{step.prompt.length > 100 ? "..." : ""}
                </p>
                {step.state.error && (
                  <p className="text-xs text-destructive mt-1">{step.state.error}</p>
                )}
                {step.state.result && step.state.status === "completed" && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {step.state.result.slice(0, 200)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
