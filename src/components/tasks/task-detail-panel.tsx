"use client";

import { useState } from "react";
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
import { formatTimestamp } from "@/lib/utils/format-timestamp";
import { MAX_RESUME_COUNT } from "@/lib/constants/task-status";
import type { TaskItem } from "./task-card";

interface TaskDetailPanelProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planned: "secondary",
  queued: "outline",
  running: "default",
  completed: "default",
  failed: "destructive",
  cancelled: "secondary",
};

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
              <Badge variant={statusColors[task.status] ?? "secondary"}>
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

            {task.assignedAgent && (
              <div>
                <h4 className="text-sm font-medium mb-1">Agent</h4>
                <p className="text-sm text-muted-foreground">{task.assignedAgent}</p>
              </div>
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
                <div>
                  <h4 className="text-sm font-medium mb-1">
                    {task.status === "failed" ? "Error" : "Result"}
                  </h4>
                  <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-auto max-h-60 whitespace-pre-wrap">
                    {task.result}
                  </pre>
                </div>
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
