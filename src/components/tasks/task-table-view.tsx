"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import type { TaskItem } from "./task-card";

const priorityLabels: Record<number, string> = {
  0: "P0 Critical",
  1: "P1 High",
  2: "P2 Medium",
  3: "P3 Low",
};

const columns: ColumnDef<TaskItem, unknown>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <span className="font-medium truncate max-w-[300px] block">
        {row.original.title}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <StatusChip status={row.original.status} />,
    size: 130,
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Priority" />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {priorityLabels[row.original.priority] ?? `P${row.original.priority}`}
      </span>
    ),
    size: 110,
  },
  {
    accessorKey: "projectName",
    header: "Project",
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
    accessorKey: "agentProfile",
    header: "Profile",
    cell: ({ row }) =>
      row.original.agentProfile ? (
        <span className="text-xs">{row.original.agentProfile}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    size: 120,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated" />
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground" suppressHydrationWarning>
        {new Date(row.original.updatedAt).toLocaleDateString()}
      </span>
    ),
    size: 100,
  },
];

interface TaskTableViewProps {
  tasks: TaskItem[];
}

export function TaskTableView({ tasks }: TaskTableViewProps) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={tasks}
      onRowClick={(task) => router.push(`/tasks/${task.id}`)}
      getRowId={(row) => row.id}
      defaultDensity="comfortable"
    />
  );
}
