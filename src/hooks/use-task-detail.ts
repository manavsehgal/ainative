import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { TaskItem } from "@/components/tasks/task-card";
import type { DocumentRow } from "@/lib/db/schema";

interface UseTaskDetailOptions {
  taskId: string | null;
  initialTask?: TaskItem;
  /** Gates fetching and polling — pass `false` to pause (e.g. when sheet is closed). */
  enabled?: boolean;
  /** Called after successful delete instead of hardcoded navigation. */
  onDeleted?: () => void;
  /** Called after any successful mutation for parent refresh. */
  onMutated?: () => void;
}

export interface UseTaskDetailReturn {
  task: TaskItem | null;
  docs: DocumentRow[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchDocs: () => Promise<void>;
  handleStatusChange: (newStatus: string) => Promise<void>;
  handleExecute: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleCancel: () => void;
  handleDelete: () => void;
  confirmCancel: boolean;
  setConfirmCancel: (open: boolean) => void;
  confirmDelete: boolean;
  setConfirmDelete: (open: boolean) => void;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  /** Actually performs the cancel after confirmation. */
  performCancel: () => Promise<void>;
  /** Actually performs the delete after confirmation. */
  performDelete: () => Promise<void>;
}

export function useTaskDetail({
  taskId,
  initialTask,
  enabled = true,
  onDeleted,
  onMutated,
}: UseTaskDetailOptions): UseTaskDetailReturn {
  const [task, setTask] = useState<TaskItem | null>(initialTask ?? null);
  const [loaded, setLoaded] = useState(!!initialTask);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  // Track previous enabled state to refetch on false→true transition
  const prevEnabled = useRef(enabled);

  const fetchDocs = useCallback(async () => {
    if (!taskId) return;
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
    if (!taskId) return;
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

  // Initial fetch + refetch on enabled transition (false→true)
  useEffect(() => {
    if (!enabled || !taskId) return;

    const wasDisabled = !prevEnabled.current;
    prevEnabled.current = enabled;

    if (!initialTask || wasDisabled) {
      refresh();
    } else {
      fetchDocs();
    }
  }, [enabled, taskId, refresh, fetchDocs, initialTask]);

  // Keep prevEnabled in sync when disabled
  useEffect(() => {
    prevEnabled.current = enabled;
  }, [enabled]);

  // Poll while running
  useEffect(() => {
    if (!enabled || task?.status !== "running") return;
    const interval = setInterval(refresh, 5_000);
    return () => clearInterval(interval);
  }, [enabled, task?.status, refresh]);

  // Reset state when taskId changes or becomes null
  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setDocs([]);
      setLoaded(false);
      setError(null);
      setConfirmCancel(false);
      setConfirmDelete(false);
      setEditOpen(false);
    }
  }, [taskId]);

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
        onMutated?.();
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
        onMutated?.();
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
        onMutated?.();
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

  async function performCancel() {
    if (!task) return;
    setConfirmCancel(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/cancel`, { method: "POST" });
      if (res.ok) {
        toast.success("Task cancelled");
        refresh();
        onMutated?.();
      } else {
        setError("Failed to cancel task");
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function performDelete() {
    if (!task) return;
    setConfirmDelete(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        sessionStorage.setItem("deletedTask", JSON.stringify(task));
        toast.success("Task deleted");
        onDeleted?.();
      } else {
        setError("Failed to delete task");
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return {
    task,
    docs,
    loaded,
    loading,
    error,
    refresh,
    fetchDocs,
    handleStatusChange,
    handleExecute,
    handleResume,
    handleCancel: () => setConfirmCancel(true),
    handleDelete: () => setConfirmDelete(true),
    confirmCancel,
    setConfirmCancel,
    confirmDelete,
    setConfirmDelete,
    editOpen,
    setEditOpen,
    performCancel,
    performDelete,
  };
}
