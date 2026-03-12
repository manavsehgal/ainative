"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Square, RotateCcw, ArrowRight, FastForward } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ContentPreview } from "./content-preview";
import { TaskAttachments } from "./task-attachments";
import { formatTimestamp } from "@/lib/utils/format-timestamp";
import { MAX_RESUME_COUNT } from "@/lib/constants/task-status";
import { taskStatusVariant } from "@/lib/constants/status-colors";
import type { TaskItem } from "./task-card";
import type { DocumentRow } from "@/lib/db/schema";

function detectContentType(content: string): "text" | "markdown" | "code" | "json" | "unknown" {
  if (content.startsWith("{") || content.startsWith("[")) {
    try { JSON.parse(content); return "json"; } catch { /* not json */ }
  }
  if (content.includes("```") || content.includes("# ") || content.includes("**")) return "markdown";
  if (content.includes("function ") || content.includes("const ") || content.includes("import ")) return "code";
  return "text";
}

const priorityLabels: Record<number, string> = {
  0: "P0 - Critical",
  1: "P1 - High",
  2: "P2 - Medium",
  3: "P3 - Low",
};

interface TaskDetailViewProps {
  taskId: string;
  initialTask?: TaskItem;
}

export function TaskDetailView({ taskId, initialTask }: TaskDetailViewProps) {
  const router = useRouter();
  const [task, setTask] = useState<TaskItem | null>(initialTask ?? null);
  const [loaded, setLoaded] = useState(!!initialTask);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?taskId=${taskId}`);
      if (res.ok) {
        setDocs(await res.json());
      }
    } catch {
      // silent — attachments are supplementary
    }
  }, [taskId]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        setTask(await res.json());
      }
    } catch {
      // silent
    }
    await fetchDocs();
    setLoaded(true);
  }, [taskId, fetchDocs]);

  useEffect(() => {
    // If server provided initial data, only fetch supplementary data (docs)
    // and skip the redundant task refresh
    if (!initialTask) refresh();
    fetchDocs();
  }, [refresh, fetchDocs, initialTask]);

  // Poll while running
  useEffect(() => {
    if (task?.status !== "running") return;
    const interval = setInterval(refresh, 5_000);
    return () => clearInterval(interval);
  }, [task?.status, refresh]);

  async function handleStatusChange(newStatus: string) {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Task ${newStatus === "queued" ? "queued" : "updated"}`);
        refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to update status (${res.status})`);
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/execute`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Task execution started");
        refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to execute task (${res.status})`);
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/resume`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Task resumed with previous context");
        refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Failed to resume task (${res.status})`);
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!task) return;
    setConfirmCancel(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/cancel`, { method: "POST" });
      if (res.ok) {
        toast.success("Task cancelled");
        refresh();
      } else {
        setError("Failed to cancel task");
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!task) {
    return <p className="text-muted-foreground">Task not found.</p>;
  }

  const inputDocs = docs.filter((doc) => doc.direction === "input");
  const outputDocs = docs.filter((doc) => doc.direction === "output");

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={taskStatusVariant[task.status] ?? "secondary"}>
              {task.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {priorityLabels[task.priority] ?? `P${task.priority}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {task.status === "planned" && (
            <Button size="sm" onClick={() => handleStatusChange("queued")} disabled={loading}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              {loading ? "Queueing..." : "Queue"}
            </Button>
          )}
          {task.status === "queued" && (
            <Button size="sm" onClick={handleExecute} disabled={loading}>
              <Play className="h-3.5 w-3.5 mr-1" />
              {loading ? "Starting..." : "Run"}
            </Button>
          )}
          {task.status === "running" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmCancel(true)}
              disabled={loading}
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              {loading ? "Cancelling..." : "Cancel"}
            </Button>
          )}
          {(task.status === "failed" || task.status === "cancelled") && (
            <>
              {task.sessionId && task.resumeCount < MAX_RESUME_COUNT && (
                <Button size="sm" onClick={handleResume} disabled={loading}>
                  <FastForward className="h-3.5 w-3.5 mr-1" />
                  {loading ? "Resuming..." : "Resume"}
                </Button>
              )}
              <Button
                size="sm"
                variant={task.sessionId ? "outline" : "default"}
                onClick={() => handleStatusChange("queued")}
                disabled={loading}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                {loading ? "Retrying..." : "Retry"}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Description */}
      {task.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Agent Info */}
      {(task.assignedAgent || task.agentProfile) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {task.assignedAgent && (
              <p className="text-sm text-muted-foreground">{task.assignedAgent}</p>
            )}
            {task.agentProfile && (
              <p className="text-sm text-muted-foreground">
                Profile: {task.agentProfile}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {docs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Documents ({docs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {inputDocs.length > 0 && (
              <TaskAttachments
                documents={inputDocs}
                title={`Input Attachments (${inputDocs.length})`}
                onDeleted={fetchDocs}
              />
            )}
            {outputDocs.length > 0 && (
              <TaskAttachments
                documents={outputDocs}
                title={`Generated Outputs (${outputDocs.length})`}
                onDeleted={fetchDocs}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Result / Error */}
      {task.result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {task.status === "failed" ? "Error" : "Result"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {task.status === "failed" ? (
              <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-auto max-h-60 whitespace-pre-wrap">
                {task.result}
              </pre>
            ) : (
              <ContentPreview content={task.result} contentType={detectContentType(task.result)} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground">
        <p>Created: {formatTimestamp(task.createdAt)}</p>
        <p>Updated: {formatTimestamp(task.updatedAt)}</p>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel task?"
        description="This will stop the running agent. Any partial progress may be lost."
        confirmLabel="Cancel Task"
        destructive
        onConfirm={handleCancel}
      />
    </div>
  );
}
