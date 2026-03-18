"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskAttachments } from "./task-attachments";
import { TaskChipBar } from "./task-chip-bar";
import { TaskBentoGrid } from "./task-bento-grid";
import { TaskResultRenderer } from "./task-result-renderer";
import { TaskEditDialog } from "./task-edit-dialog";
import type { TaskItem } from "./task-card";
import type { DocumentRow } from "@/lib/db/schema";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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

  async function handleDelete() {
    if (!task) return;
    setConfirmDelete(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        sessionStorage.setItem("deletedTask", JSON.stringify(task));
        toast.success("Task deleted");
        router.push("/dashboard");
      } else {
        setError("Failed to delete task");
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
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
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
    <div className="space-y-4" aria-live="polite">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <TaskChipBar
        task={task}
        loading={loading}
        onEdit={() => setEditOpen(true)}
        onQueue={() => handleStatusChange("queued")}
        onRun={handleExecute}
        onCancel={() => setConfirmCancel(true)}
        onResume={handleResume}
        onRetry={() => handleStatusChange("queued")}
        onDelete={() => setConfirmDelete(true)}
      />

      <TaskBentoGrid task={task} docs={docs} />

      {docs.length > 0 && (
        <div className="surface-card-muted rounded-lg p-4 space-y-4">
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
        </div>
      )}

      {(task.description || task.result) && (
        <TaskResultRenderer
          description={task.description}
          result={task.result}
          status={task.status}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel task?"
        description="This will stop the running agent. Any partial progress may be lost."
        confirmLabel="Cancel Task"
        destructive
        onConfirm={handleCancel}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete task?"
        description="This action cannot be undone. The task and its history will be permanently deleted."
        confirmLabel="Delete Task"
        destructive
        onConfirm={handleDelete}
      />
      <TaskEditDialog
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={refresh}
      />
    </div>
  );
}
