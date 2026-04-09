"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  FileText,
  Paperclip,
  ArrowRight,
  FolderKanban,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";
import { IconCircle, getWorkflowIconFromName } from "@/lib/constants/card-icons";
import { LoopStatusView } from "./loop-status-view";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PROSE_NOTIFICATION } from "@/lib/constants/prose-styles";
import { SwarmDashboard } from "./swarm-dashboard";
import { WorkflowFullOutput } from "./workflow-full-output";
import type { LoopState, LoopConfig, SwarmConfig } from "@/lib/workflows/types";
import { formatDuration } from "@/lib/workflows/delay";

interface StepWithState {
  id: string;
  name: string;
  prompt: string;
  requiresApproval?: boolean;
  dependsOn?: string[];
  /** If set, this step is a pure time delay (no prompt/profile). Format: Nm|Nh|Nd|Nw. */
  delayDuration?: string;
  state: {
    stepId: string;
    status: string;
    taskId?: string;
    result?: string;
    error?: string;
  };
}

interface DocumentInfo {
  id: string;
  originalName: string;
  mimeType: string;
  storagePath: string;
  direction: string;
}

interface WorkflowStatusData {
  id: string;
  name: string;
  status: string;
  /** Epoch ms when a paused (delayed) workflow is due to resume, or null. */
  resumeAt?: number | null;
  pattern: string;
  projectId?: string | null;
  definition?: string;
  steps: StepWithState[];
  loopConfig?: LoopConfig;
  loopState?: LoopState;
  swarmConfig?: SwarmConfig;
  stepDocuments?: Record<string, DocumentInfo[]>;
  parentDocuments?: DocumentInfo[];
  runNumber?: number;
  runHistory?: Array<{
    runNumber: number | null;
    taskCount: number;
    completedCount: number;
    failedCount: number;
  }>;
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
  delayed: <Clock3 className="h-4 w-4 text-status-warning" />,
};

/**
 * Body content for a delay step row in the workflow status view.
 * Renders three visual states:
 *   - Pending (workflow hasn't reached this step yet): "Will wait 3d"
 *   - Active delay (workflow paused, waiting): absolute resume time + remaining duration + Resume Now button
 *   - Completed (workflow has already passed this step): "Delayed 3d — completed"
 *
 * Countdown is static on mount/focus — no per-second ticking (accessibility concern).
 */
function DelayStepBody({
  workflowId,
  delayDuration,
  stepStatus,
  resumeAt,
}: {
  workflowId: string;
  delayDuration: string;
  stepStatus: string;
  resumeAt: number | null;
}) {
  const [resuming, setResuming] = useState(false);

  const handleResumeNow = useCallback(async () => {
    setResuming(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/resume`, { method: "POST" });
      if (res.status === 202) {
        toast.success("Resume dispatched");
      } else if (res.status === 409) {
        toast.info("Workflow already resumed by scheduler");
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to resume workflow");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume workflow");
    } finally {
      setResuming(false);
    }
  }, [workflowId]);

  if (stepStatus === "completed") {
    return (
      <p className="text-xs text-muted-foreground mt-0.5">
        Delayed {delayDuration} — completed
      </p>
    );
  }

  if (stepStatus === "delayed" && resumeAt) {
    const resumeDate = new Date(resumeAt);
    const remainingMs = Math.max(0, resumeAt - Date.now());
    const remainingLabel = remainingMs < 60_000
      ? "less than a minute"
      : formatDuration(Math.round(remainingMs / 60_000) * 60_000);
    return (
      <div className="mt-1 space-y-2">
        <p className="text-xs text-status-warning">
          Resumes{" "}
          <time dateTime={resumeDate.toISOString()}>
            {resumeDate.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            })}
          </time>{" "}
          <span className="text-muted-foreground">({remainingLabel} remaining)</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleResumeNow}
          disabled={resuming}
          aria-label="Resume workflow now"
        >
          <Play className="h-3 w-3 mr-1" />
          {resuming ? "Resuming..." : "Resume Now"}
        </Button>
      </div>
    );
  }

  // Pending / upcoming delay — workflow hasn't reached this step yet
  return (
    <p className="text-xs text-muted-foreground mt-0.5">
      Will wait {delayDuration}
    </p>
  );
}

/** Expandable step result with gradient fade progressive disclosure */
export function ExpandableResult({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!result) return null;

  return (
    <div className="mt-2">
      <div
        className={`${PROSE_NOTIFICATION} ${
          expanded
            ? "max-h-96 overflow-auto"
            : result.length > 200
              ? "max-h-20 overflow-hidden mask-fade-bottom"
              : ""
        }`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
      </div>
      {result.length > 200 && (
        <button
          type="button"
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/** Document list for a single step or parent task */
function DocumentList({ docs, label }: { docs: DocumentInfo[]; label: string }) {
  if (docs.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        {docs.map((doc) => (
          <Link
            key={doc.id}
            href={`/documents/${doc.id}`}
            className="flex items-center gap-2 text-xs text-brand-blue hover:underline"
          >
            <FileText className="h-3 w-3 shrink-0" />
            {doc.originalName}
          </Link>
        ))}
      </div>
    </div>
  );
}


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

  // Collect all completed step outputs for full output sheet
  const completedStepOutputs = data.steps
    .filter((s) => s.state?.result && s.state?.status === "completed")
    .map((s) => ({ name: s.name, result: s.state!.result! }));

  // Check for any documents
  const hasStepDocs = data.stepDocuments && Object.keys(data.stepDocuments).length > 0;
  const hasParentDocs = data.parentDocuments && data.parentDocuments.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconCircle
                icon={getWorkflowIconFromName(data.name, data.pattern).icon}
                colors={getWorkflowIconFromName(data.name, data.pattern).colors}
              />
              <div>
                <CardTitle>{data.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {patternLabels[data.pattern] ?? data.pattern}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {data.projectId && (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-accent gap-1"
                      onClick={() => router.push(`/projects/${data.projectId}`)}
                    >
                      <FolderKanban className="h-3 w-3" />
                      Project
                    </Badge>
                  )}
                  {data.runNumber != null && data.runNumber > 0 && (
                    <Badge variant="outline" className="text-xs font-normal">
                      Run #{data.runNumber}
                    </Badge>
                  )}
                </div>
              </div>
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

              {/* Edit — draft, completed, or failed */}
              {["draft", "completed", "failed"].includes(data.status) && hasDefinition && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/workflows/${workflowId}/edit`)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}

              {/* Clone — always available */}
              {hasDefinition && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/workflows/${workflowId}/edit?clone=true`)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Clone
                </Button>
              )}

              {/* Re-run — completed/failed only */}
              {(data.status === "completed" || data.status === "failed") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRerun}
                  disabled={executing}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Re-run
                </Button>
              )}

              {/* Delete — not active */}
              {data.status !== "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
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
                                <ExpandableResult result={step.state.result} />
                              )}
                              {/* Step output documents */}
                              {step.state.taskId && data.stepDocuments?.[step.state.taskId] && (
                                <DocumentList
                                  docs={data.stepDocuments[step.state.taskId]}
                                  label="Generated Files"
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
                                <ExpandableResult result={synthesisStep.state.result} />
                              )}
                            {/* Synthesis step documents */}
                            {synthesisStep.state.taskId && data.stepDocuments?.[synthesisStep.state.taskId] && (
                              <DocumentList
                                docs={data.stepDocuments[synthesisStep.state.taskId]}
                                label="Generated Files"
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
                  {data.steps.map((step, index) => {
                    const isDelayStep = !!step.delayDuration;
                    const isActiveDelay = isDelayStep && step.state.status === "delayed";
                    return (
                      <div key={`${step.id}-${index}`} className="flex items-start gap-3">
                        <div className="mt-0.5 flex flex-col items-center">
                          {isDelayStep && step.state.status === "pending" ? (
                            <Clock3 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            stepStatusIcons[step.state.status] ?? stepStatusIcons.pending
                          )}
                          {index < data.steps.length - 1 && (
                            <div className="mt-1 h-6 w-px bg-border" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{step.name}</span>
                            {isDelayStep && (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Delay
                              </Badge>
                            )}
                            {step.requiresApproval && !isDelayStep && (
                              <Badge variant="outline" className="text-xs">
                                checkpoint
                              </Badge>
                            )}
                          </div>
                          {isDelayStep ? (
                            <DelayStepBody
                              workflowId={data.id}
                              delayDuration={step.delayDuration!}
                              stepStatus={step.state.status}
                              resumeAt={isActiveDelay ? data.resumeAt ?? null : null}
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">
                                {step.prompt.slice(0, 100)}
                                {step.prompt.length > 100 ? "..." : ""}
                              </p>
                              {step.state.taskId && (
                                <a
                                  href={`/tasks/${step.state.taskId}`}
                                  className="text-[10px] text-primary hover:underline shrink-0"
                                >
                                  view task
                                </a>
                              )}
                            </div>
                          )}
                          {/* Parent document context indicator */}
                          {data.parentDocuments && data.parentDocuments.length > 0 && index === 0 && !isDelayStep && (
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {data.parentDocuments.length} doc{data.parentDocuments.length !== 1 ? "s" : ""} attached
                              </Badge>
                            </div>
                          )}
                          {step.state.error && (
                            <p className="text-xs text-destructive mt-1">
                              {step.state.error}
                            </p>
                          )}
                          {step.state.result && step.state.status === "completed" && !isDelayStep && (
                            <ExpandableResult result={step.state.result} />
                          )}
                          {/* Step output documents */}
                          {step.state.taskId && data.stepDocuments?.[step.state.taskId] && (
                            <DocumentList
                              docs={data.stepDocuments[step.state.taskId]}
                              label="Generated Files"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Documents section — parent inputs and step outputs */}
          {(hasParentDocs || hasStepDocs) && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Documents</p>
              </div>
              {hasParentDocs && (
                <DocumentList docs={data.parentDocuments!} label="Input Files" />
              )}
              {hasStepDocs && Object.entries(data.stepDocuments!).map(([taskId, docs]) => {
                const step = data.steps.find((s) => s.state.taskId === taskId);
                return (
                  <DocumentList
                    key={taskId}
                    docs={docs}
                    label={step ? `Output: ${step.name}` : "Output Files"}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full output — inline below workflow card when completed */}
      {data.status === "completed" && completedStepOutputs.length > 0 && (
        <WorkflowFullOutput
          workflowName={data.name}
          steps={completedStepOutputs}
        />
      )}

      {/* Output Dock — chain into new workflow */}
      {data.status === "completed" && hasStepDocs && (
        <OutputDock stepDocuments={data.stepDocuments!} steps={data.steps} />
      )}

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
    </div>
  );
}

/** Output Dock — selectable output documents for chaining into a new workflow */
function OutputDock({
  stepDocuments,
  steps,
}: {
  stepDocuments: Record<string, DocumentInfo[]>;
  steps: StepWithState[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Flatten all output documents
  const allOutputDocs = Object.entries(stepDocuments).flatMap(
    ([taskId, docs]) => {
      const step = steps.find((s) => s.state.taskId === taskId);
      return docs.map((doc) => ({
        ...doc,
        stepName: step?.name ?? "Unknown Step",
      }));
    }
  );

  if (allOutputDocs.length === 0) return null;

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(allOutputDocs.map((d) => d.id)));
  }

  function chainIntoNewWorkflow() {
    if (selectedIds.size === 0) return;
    const params = new URLSearchParams({
      inputDocs: [...selectedIds].join(","),
    });
    router.push(`/workflows/new?${params}`);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Chain Output Documents
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="text-xs"
          >
            Select All
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Select output documents to use as inputs in a new workflow
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {allOutputDocs.map((doc) => {
            const isChecked = selectedIds.has(doc.id);
            return (
              <div
                key={doc.id}
                role="button"
                tabIndex={0}
                onClick={() => toggleDoc(doc.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDoc(doc.id); } }}
                className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors border cursor-pointer ${
                  isChecked
                    ? "bg-accent/50 border-accent"
                    : "hover:bg-muted/50 border-border/50"
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => toggleDoc(doc.id)}
                />
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {doc.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.stepName}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {selectedIds.size > 0 && (
          <Button
            onClick={chainIntoNewWorkflow}
            className="w-full gap-2"
            size="sm"
          >
            <ArrowRight className="h-4 w-4" />
            Chain {selectedIds.size} Document{selectedIds.size !== 1 ? "s" : ""} Into New Workflow
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
