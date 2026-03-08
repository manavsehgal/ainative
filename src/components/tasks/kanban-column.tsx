"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard, type TaskItem } from "./task-card";
import type { TaskStatus } from "@/lib/constants/task-status";

const columnLabels: Record<string, string> = {
  planned: "Planned",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="text-sm font-medium">{columnLabels[status] ?? status}</h3>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-lg border border-dashed p-2 min-h-[200px] transition-colors ${
          isOver ? "bg-accent/50 border-primary" : "border-transparent"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                No tasks
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={onTaskClick} />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
