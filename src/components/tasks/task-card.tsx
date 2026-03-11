"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bot, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { TaskStatus } from "@/lib/constants/task-status";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  assignedAgent: string | null;
  agentProfile: string | null;
  projectId: string | null;
  projectName?: string;
  result: string | null;
  sessionId: string | null;
  resumeCount: number;
  createdAt: string;
  updatedAt: string;
}

const priorityConfig: Record<number, { color: string; label: string; Icon: typeof ArrowUp }> = {
  0: { color: "text-destructive", label: "Critical", Icon: ArrowUp },
  1: { color: "text-chart-5", label: "High", Icon: ArrowUp },
  2: { color: "text-primary", label: "Medium", Icon: Minus },
  3: { color: "text-muted-foreground", label: "Low", Icon: ArrowDown },
};

export function TaskCard({
  task,
  onClick,
}: {
  task: TaskItem;
  onClick: (task: TaskItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isFailed = task.status === "failed";
  const isRunning = task.status === "running";
  const priority = priorityConfig[task.priority] ?? priorityConfig[3];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`${task.title}, ${priority.label} priority, ${task.status}`}
      className={`surface-card p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      } ${isFailed ? "border-l-4 border-l-destructive" : ""}`}
      onClick={() => onClick(task)}
    >
      <div className="flex items-start gap-2">
        <priority.Icon
          className={`mt-1 h-3.5 w-3.5 shrink-0 ${priority.color}`}
          aria-label={`${priority.label} priority`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-2">{task.title}</p>
          {task.projectName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.projectName}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {task.agentProfile && (
              <Badge variant="outline" className="text-xs gap-1">
                <Bot className="h-3 w-3" aria-hidden="true" />
                {task.agentProfile}
              </Badge>
            )}
            {task.assignedAgent && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Bot className="h-3 w-3" aria-hidden="true" />
                {task.assignedAgent}
              </Badge>
            )}
            {isFailed && <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-label="Task failed" />}
            {isRunning && (
              <span className="flex h-2 w-2" aria-label="Task running">
                <span className="animate-ping absolute h-2 w-2 rounded-full bg-primary/60 opacity-75" />
                <span className="relative rounded-full h-2 w-2 bg-primary" />
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
