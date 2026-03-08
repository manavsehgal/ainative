"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bot } from "lucide-react";
import type { TaskStatus } from "@/lib/constants/task-status";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  assignedAgent: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

const priorityColors: Record<number, string> = {
  0: "bg-red-500",
  1: "bg-orange-500",
  2: "bg-blue-500",
  3: "bg-gray-400",
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      } ${isFailed ? "border-l-4 border-l-red-500" : ""}`}
      onClick={() => onClick(task)}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priorityColors[task.priority] ?? "bg-gray-400"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-2">{task.title}</p>
          <div className="flex items-center gap-2 mt-2">
            {task.assignedAgent && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Bot className="h-3 w-3" />
                {task.assignedAgent}
              </Badge>
            )}
            {isFailed && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
            {isRunning && (
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75" />
                <span className="relative rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
