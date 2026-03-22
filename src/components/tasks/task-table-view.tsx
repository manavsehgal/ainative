"use client";

import { useState, useMemo, useCallback } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { DataTable, type Density } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskEditDialog } from "./task-edit-dialog";
import { Eye, Pencil, Trash2, RotateCw, MoreHorizontal, ListTodo, Workflow } from "lucide-react";
import { toast } from "sonner";
import { patternLabels } from "@/lib/constants/status-colors";
import { compareTasks, type SortOrder } from "./kanban-board";
import type { TaskItem } from "./task-card";
import type { WorkflowKanbanItem } from "@/components/workflows/workflow-kanban-card";

// --- Unified row type ---

export type DashboardRow =
  | (TaskItem & { _rowType: "task" })
  | (WorkflowKanbanItem & { _rowType: "workflow" });

function isTaskRow(row: DashboardRow): row is TaskItem & { _rowType: "task" } {
  return row._rowType === "task";
}

// --- Priority labels ---

const priorityLabels: Record<number, string> = {
  0: "P0 Critical",
  1: "P1 High",
  2: "P2 Medium",
  3: "P3 Low",
};

// --- Column definitions ---

function getColumns(
  onView: (row: DashboardRow) => void,
  onEdit: (row: DashboardRow) => void,
  onDelete: (row: DashboardRow) => void,
  onRerun: (row: DashboardRow) => void,
): ColumnDef<DashboardRow, unknown>[] {
  return [
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => {
        const isTask = isTaskRow(row.original);
        return (
          <div className="flex items-center gap-1.5">
            {isTask ? (
              <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Workflow className="h-3.5 w-3.5 text-primary" />
            )}
            <span className="text-xs text-muted-foreground">
              {isTask ? "Task" : "Workflow"}
            </span>
          </div>
        );
      },
      size: 100,
    },
    {
      id: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      accessorFn: (row) => (isTaskRow(row) ? row.title : row.name),
      cell: ({ row }) => (
        <span className="font-medium truncate max-w-[300px] block">
          {isTaskRow(row.original) ? row.original.title : row.original.name}
        </span>
      ),
    },
    {
      id: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      accessorFn: (row) => row.status,
      cell: ({ row }) => <StatusChip status={row.original.status} />,
      size: 130,
    },
    {
      id: "detail",
      header: "Priority / Pattern",
      cell: ({ row }) => {
        if (isTaskRow(row.original)) {
          return (
            <span className="text-xs text-muted-foreground">
              {priorityLabels[row.original.priority] ?? `P${row.original.priority}`}
            </span>
          );
        }
        return (
          <Badge variant="outline" className="text-xs">
            {patternLabels[row.original.pattern] ?? row.original.pattern}
          </Badge>
        );
      },
      size: 140,
    },
    {
      id: "projectName",
      header: "Project",
      accessorFn: (row) => row.projectName,
      cell: ({ row }) =>
        row.original.projectName ? (
          <Badge variant="outline" className="text-xs">
            {row.original.projectName}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      size: 150,
    },
    {
      id: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      accessorFn: (row) => isTaskRow(row) ? row.updatedAt : (row.updatedAt ?? row.createdAt),
      cell: ({ row }) => {
        const date = isTaskRow(row.original)
          ? row.original.updatedAt
          : (row.original.updatedAt ?? row.original.createdAt);
        return (
          <span className="text-xs text-muted-foreground" suppressHydrationWarning>
            {new Date(date).toLocaleDateString()}
          </span>
        );
      },
      size: 100,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const item = row.original;
        const isTask = isTaskRow(item);
        const canEdit = isTask || item.status === "draft";
        const canRerun = !isTask && (item.status === "completed" || item.status === "failed");
        const canDelete = isTask
          ? item.status !== "running"
          : item.status !== "active";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(item); }}>
                <Eye className="h-3.5 w-3.5 mr-2" />
                View
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canRerun && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRerun(item); }}>
                  <RotateCw className="h-3.5 w-3.5 mr-2" />
                  Re-run
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 50,
    },
  ];
}

// --- Main component ---

interface TaskTableViewProps {
  tasks: TaskItem[];
  workflows: WorkflowKanbanItem[];
  projects: { id: string; name: string }[];
  projectFilter: string;
  statusFilter: string;
  sortOrder: SortOrder;
  density: Density;
  /** Open task detail sheet instead of navigating to full page */
  onTaskSelect?: (taskId: string) => void;
}

/** Map workflow status to task-equivalent for status filtering */
function workflowStatusToTaskStatus(status: string): string {
  switch (status) {
    case "draft": return "planned";
    case "paused": return "planned";
    case "active": return "running";
    default: return status;
  }
}

export function TaskTableView({
  tasks,
  workflows,
  projects,
  projectFilter,
  statusFilter,
  sortOrder,
  density,
  onTaskSelect,
}: TaskTableViewProps) {
  const router = useRouter();
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardRow | null>(null);

  // Merge, filter, and sort rows
  const rows = useMemo(() => {
    // Tag rows with discriminator
    const taskRows: DashboardRow[] = tasks.map((t) => ({ ...t, _rowType: "task" as const }));
    const workflowRows: DashboardRow[] = workflows.map((w) => ({ ...w, _rowType: "workflow" as const }));
    const allRows = [...taskRows, ...workflowRows];

    // Filter
    const filtered = allRows.filter((row) => {
      if (projectFilter !== "all") {
        const pid = isTaskRow(row) ? row.projectId : row.projectId;
        if (pid !== projectFilter) return false;
      }
      if (statusFilter !== "all") {
        const effectiveStatus = isTaskRow(row) ? row.status : workflowStatusToTaskStatus(row.status);
        if (effectiveStatus !== statusFilter) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      // Convert both to comparable form
      if (isTaskRow(a) && isTaskRow(b)) {
        return compareTasks(a, b, sortOrder);
      }
      // For mixed or workflow-only, sort by date/title
      switch (sortOrder) {
        case "priority": {
          // Tasks before workflows, then by priority/date
          if (isTaskRow(a) && !isTaskRow(b)) return -1;
          if (!isTaskRow(a) && isTaskRow(b)) return 1;
          return 0;
        }
        case "created-desc": {
          const dateA = isTaskRow(a) ? a.createdAt : a.createdAt;
          const dateB = isTaskRow(b) ? b.createdAt : b.createdAt;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        }
        case "created-asc": {
          const dateA = isTaskRow(a) ? a.createdAt : a.createdAt;
          const dateB = isTaskRow(b) ? b.createdAt : b.createdAt;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        }
        case "title-asc": {
          const titleA = isTaskRow(a) ? a.title : a.name;
          const titleB = isTaskRow(b) ? b.title : b.name;
          return titleA.localeCompare(titleB);
        }
      }
    });

    return filtered;
  }, [tasks, workflows, projectFilter, statusFilter, sortOrder]);

  // Action handlers
  const handleView = useCallback((row: DashboardRow) => {
    if (isTaskRow(row)) {
      onTaskSelect ? onTaskSelect(row.id) : router.push(`/tasks/${row.id}`);
    } else {
      router.push(`/workflows/${row.id}`);
    }
  }, [router, onTaskSelect]);

  const handleEdit = useCallback((row: DashboardRow) => {
    if (isTaskRow(row)) {
      setEditingTask(row);
    } else {
      router.push(`/workflows/${row.id}/edit`);
    }
  }, [router]);

  const handleRerun = useCallback(async (row: DashboardRow) => {
    if (isTaskRow(row)) return;
    try {
      const res = await fetch(`/api/workflows/${row.id}/execute`, { method: "POST" });
      if (res.ok) {
        toast.success("Workflow re-started");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to re-run workflow");
      }
    } catch {
      toast.error("Network error");
    }
  }, [router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const isTask = isTaskRow(deleteTarget);
    const endpoint = isTask
      ? `/api/tasks/${deleteTarget.id}`
      : `/api/workflows/${deleteTarget.id}`;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        toast.success(`${isTask ? "Task" : "Workflow"} deleted`);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? `Failed to delete ${isTask ? "task" : "workflow"}`);
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, router]);

  const columns = useMemo(
    () => getColumns(handleView, handleEdit, setDeleteTarget, handleRerun),
    [handleView, handleEdit, handleRerun],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={handleView}
        getRowId={(row) => `${row._rowType}-${row.id}`}
        controlledDensity={density}
        hideToolbar
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete ${deleteTarget ? (isTaskRow(deleteTarget) ? "task" : "workflow") : "item"}?`}
        description="This action cannot be undone. The item will be permanently deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
      />

      {/* Task edit dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onUpdated={() => router.refresh()}
      />
    </>
  );
}
