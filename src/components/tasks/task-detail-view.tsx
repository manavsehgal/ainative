"use client";

import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskAttachments } from "./task-attachments";
import { TaskChipBar } from "./task-chip-bar";
import { TaskBentoGrid } from "./task-bento-grid";
import { TaskResultRenderer } from "./task-result-renderer";
import { TaskEditDialog } from "./task-edit-dialog";
import { useTaskDetail } from "@/hooks/use-task-detail";
import type { TaskItem } from "./task-card";

interface TaskDetailViewProps {
  taskId: string;
  initialTask?: TaskItem;
}

export function TaskDetailView({ taskId, initialTask }: TaskDetailViewProps) {
  const router = useRouter();

  const {
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
    handleCancel,
    handleDelete,
    confirmCancel,
    setConfirmCancel,
    confirmDelete,
    setConfirmDelete,
    editOpen,
    setEditOpen,
    performCancel,
    performDelete,
  } = useTaskDetail({
    taskId,
    initialTask,
    enabled: true,
    onDeleted: () => router.push("/dashboard"),
  });

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
        onCancel={handleCancel}
        onResume={handleResume}
        onRetry={() => handleStatusChange("queued")}
        onDelete={handleDelete}
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
        onConfirm={performCancel}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete task?"
        description="This action cannot be undone. The task and its history will be permanently deleted."
        confirmLabel="Delete Task"
        destructive
        onConfirm={performDelete}
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
