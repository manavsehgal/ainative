"use client";

import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskTableView } from "@/components/tasks/task-table-view";
import { TaskViewToggle, useTaskView } from "@/components/tasks/task-view-toggle";
import type { TaskItem } from "@/components/tasks/task-card";
import type { WorkflowKanbanItem } from "@/components/workflows/workflow-kanban-card";

interface TaskSurfaceProps {
  initialTasks: TaskItem[];
  initialWorkflows: WorkflowKanbanItem[];
  projects: { id: string; name: string }[];
}

/**
 * TaskSurface — board/table view toggle for the task surface.
 * Wraps KanbanBoard and TaskTableView with a persisted view preference.
 */
export function TaskSurface({
  initialTasks,
  initialWorkflows,
  projects,
}: TaskSurfaceProps) {
  const [view, setView] = useTaskView();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TaskViewToggle view={view} onViewChange={setView} />
      </div>

      {view === "board" ? (
        <KanbanBoard
          initialTasks={initialTasks}
          initialWorkflows={initialWorkflows}
          projects={projects}
        />
      ) : (
        <TaskTableView tasks={initialTasks} />
      )}
    </div>
  );
}
