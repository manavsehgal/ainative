"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

interface TaskDetailPanelProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

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

export function TaskDetailPanel({
  task,
  open,
  onOpenChange,
  onUpdated,
}: TaskDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const fetchDocs = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/documents?taskId=${taskId}`);
      if (res.ok) {
        setDocs(await res.json());
      }
    } catch {
      // silent — attachments are supplementary
    }
  }, []);

  useEffect(() => {
    if (task && open) {
      fetchDocs(task.id);
    } else {
      setDocs([]);
    }
  }, [task?.id, open, fetchDocs]);

  if (!task) return null;

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
        onOpenChange(false);
        onUpdated();
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
        onOpenChange(false);
        onUpdated();
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
        onOpenChange(false);
        onUpdated();
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/cancel`, { method: "POST" });
      if (res.ok) {
        toast.success("Task cancelled");
        onOpenChange(false);
        onUpdated();
      } else {
        setError("Failed to cancel task");
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md w-full">
          <SheetHeader className="px-6 pt-6 pb-0">
            <SheetTitle className="text-left pr-6">{task.title}</SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-6 space-y-4 overflow-y-auto">
            <div className="flex items-center gap-2">
              <Badge variant={taskStatusVariant[task.status] ?? "secondary"}>
                {task.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {priorityLabels[task.priority] ?? `P${task.priority}`}
              </span>
            </div>

            {task.description && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              </>
            )}

            {(task.assignedAgent || task.agentProfile) && (
              <div>
                <h4 className="text-sm font-medium mb-1">Agent</h4>
                {task.assignedAgent && (
                  <p className="text-sm text-muted-foreground">{task.assignedAgent}</p>
                )}
                {task.agentProfile && (
                  <p className="text-sm text-muted-foreground">
                    Profile: {task.agentProfile}
                  </p>
                )}
              </div>
            )}

            {docs.length > 0 && (
              <>
                <Separator />
                <TaskAttachments
                  documents={docs}
                  onDeleted={() => fetchDocs(task!.id)}
                />
              </>
            )}

            <Separator />

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2 flex-wrap">
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

            {task.result && (
              <>
                <Separator />
                {task.status === "failed" ? (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Error</h4>
                    <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-auto max-h-60 whitespace-pre-wrap">
                      {task.result}
                    </pre>
                  </div>
                ) : (
                  <ContentPreview content={task.result} contentType={detectContentType(task.result)} />
                )}
              </>
            )}

            <div className="text-xs text-muted-foreground">
              <p>Created: {formatTimestamp(task.createdAt)}</p>
              <p>Updated: {formatTimestamp(task.updatedAt)}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel task?"
        description="This will stop the running agent. Any partial progress may be lost."
        confirmLabel="Cancel Task"
        destructive
        onConfirm={handleCancel}
      />
    </>
  );
}
