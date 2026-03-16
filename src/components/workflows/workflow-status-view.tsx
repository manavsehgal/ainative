"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  ShieldQuestion,
  Play,
  Pencil,
  Copy,
  RotateCcw,
  Trash2,
  Clock3,
  GitBranch,
  MessageSquareMore,
} from "lucide-react";
import { toast } from "sonner";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";
import { LoopStatusView } from "./loop-status-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LightMarkdown } from "@/components/shared/light-markdown";
import { SwarmDashboard } from "./swarm-dashboard";
import type { LoopState, LoopConfig, SwarmConfig } from "@/lib/workflows/types";

interface StepWithState {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;
  dependsOn?: string[];
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
  projectId?: string | null;
  definition?: string;
  steps: StepWithState[];
  loopConfig?: LoopConfig;
  loopState?: LoopState;
  swarmConfig?: SwarmConfig;
}

interface WorkflowStatusViewProps {
  workflowId: string;
}

const stepStatusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 text-status-running animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-status-completed" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  waiting_approval: <ShieldQuestion className="h-4 w-4 text-status-warning" />,
  waiting_dependencies: <Clock3 className="h-4 w-4 text-status-warning" />,
};


export function WorkflowStatusView({ workflowId }: WorkflowStatusViewProps) {
  const router = useRouter();
  const [data, setData] = useState<WorkflowStatusData | null>(null);
  const [executing, setExecuting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    // Optimistic update — immediately show "active" status
    if (data) {
      setData({
        ...data,
        status: "active",
        steps: data.steps.map((step, index) => {
          if (data.pattern === "swarm") {
            const lastIndex = data.steps.length - 1;
            return {
              ...step,
              state: {
                ...step.state,
                status:
                  index === 0
                    ? "running"
                    : index === lastIndex
                      ? "waiting_dependencies"
                      : "pending",
              },
            };
          }

          if (data.pattern === "parallel") {
            const isJoin = !!step.dependsOn?.length;
            return {
              ...step,
              state: {
                ...step.state,
                status: isJoin
                  ? "waiting_dependencies"
                  : index === 0
                    ? "running"
                    : "pending",
              },
            };
          }

          return index === 0
            ? { ...step, state: { ...step.state, status: "running" } }
            : step;
        }),
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

  async function handleRerun() {
    setExecuting(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Workflow re-started");
        fetchStatus();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error ?? "Failed to re-run workflow");
      }
    } finally {
      setExecuting(false);
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    const res = await fetch(`/api/workflows/${workflowId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Workflow deleted");
      router.push("/workflows");
    } else {
      const err = await res.json().catch(() => null);
      toast.error(err?.error ?? "Failed to delete workflow");
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

  const hasDefinition = !!data.definition;
  const parallelBranches =
    data.pattern === "parallel"
      ? data.steps.filter((step) => !step.dependsOn?.length)
      : [];
  const synthesisStep =
    data.pattern === "parallel"
      ? data.steps.find((step) => step.dependsOn?.length) ?? null
      : null;

  return (
    <>
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

              {/* Execute button for draft/paused non-loop workflows */}
              {data.pattern !== "loop" && (data.status === "draft" || data.status === "paused") && (
                <Button size="sm" onClick={startExecution} disabled={executing}>
                  <Play className="h-3 w-3 mr-1" />
                  {executing ? "Starting..." : "Execute"}
                </Button>
              )}

              {/* Edit — draft only */}
              {data.status === "draft" && hasDefinition && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Edit workflow"
                  onClick={() => router.push(`/workflows/${workflowId}/edit`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Clone — always available */}
              {hasDefinition && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Clone workflow"
                  onClick={() => router.push(`/workflows/${workflowId}/edit?clone=true`)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Re-run — completed/failed only */}
              {(data.status === "completed" || data.status === "failed") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Re-run workflow"
                  onClick={handleRerun}
                  disabled={executing}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* Delete — not active */}
              {data.status !== "active" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  aria-label="Delete workflow"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loop prompt display */}
          {data.pattern === "loop" && data.steps[0]?.prompt && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Loop Prompt</p>
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-sm whitespace-pre-wrap">{data.steps[0].prompt}</p>
              </div>
            </div>
          )}

          {data.pattern === "loop" && data.loopConfig ? (
            <LoopStatusView
              workflowId={workflowId}
              workflowStatus={data.status}
              loopConfig={data.loopConfig}
              loopState={data.loopState ?? null}
              onRefresh={fetchStatus}
            />
          ) : data.pattern === "swarm" ? (
            <SwarmDashboard
              workflowId={workflowId}
              workflowStatus={data.status}
              steps={data.steps}
              swarmConfig={data.swarmConfig}
              onRefresh={fetchStatus}
              stepStatusIcons={stepStatusIcons}
            />
          ) : (
            <div className="space-y-4" aria-live="polite">
              {data.pattern === "parallel" && parallelBranches.length > 0 ? (
                <>
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Parallel Branches</p>
                      <Badge variant="secondary" className="text-xs">
                        {parallelBranches.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {parallelBranches.map((step, index) => (
                        <div
                          key={step.id}
                          className="surface-card-muted rounded-lg border border-border/50 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {stepStatusIcons[step.state.status] ?? stepStatusIcons.pending}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[11px]">
                                  Branch {index + 1}
                                </Badge>
                                <span className="text-sm font-medium">{step.name}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {step.prompt}
                              </p>
                              {step.state.error && (
                                <p className="mt-2 text-xs text-destructive">
                                  {step.state.error}
                                </p>
                              )}
                              {step.state.result && step.state.status === "completed" && (
                                <LightMarkdown
                                  content={step.state.result.slice(0, 500)}
                                  lineClamp={4}
                                  className="mt-2"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {synthesisStep && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquareMore className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Synthesis Step</p>
                      </div>
                      <div className="surface-card-muted rounded-lg border border-border/50 p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {stepStatusIcons[synthesisStep.state.status] ??
                              stepStatusIcons.pending}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[11px]">
                                join
                              </Badge>
                              <span className="text-sm font-medium">
                                {synthesisStep.name}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {synthesisStep.prompt}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Waits for all {parallelBranches.length} branches before
                              running.
                            </p>
                            {synthesisStep.state.error && (
                              <p className="mt-2 text-xs text-destructive">
                                {synthesisStep.state.error}
                              </p>
                            )}
                            {synthesisStep.state.result &&
                              synthesisStep.state.status === "completed" && (
                                <LightMarkdown
                                  content={synthesisStep.state.result.slice(0, 500)}
                                  lineClamp={4}
                                  className="mt-2"
                                />
                              )}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  {data.steps.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="mt-0.5 flex flex-col items-center">
                        {stepStatusIcons[step.state.status] ?? stepStatusIcons.pending}
                        {index < data.steps.length - 1 && (
                          <div className="mt-1 h-6 w-px bg-border" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.name}</span>
                          {step.requiresApproval && (
                            <Badge variant="outline" className="text-xs">
                              checkpoint
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {step.prompt.slice(0, 100)}
                          {step.prompt.length > 100 ? "..." : ""}
                        </p>
                        {step.state.error && (
                          <p className="text-xs text-destructive mt-1">
                            {step.state.error}
                          </p>
                        )}
                        {step.state.result && step.state.status === "completed" && (
                          <LightMarkdown
                            content={step.state.result.slice(0, 500)}
                            lineClamp={2}
                            className="mt-1"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Workflow"
        description="This will permanently delete this workflow and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}
