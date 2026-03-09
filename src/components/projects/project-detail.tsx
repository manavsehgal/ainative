"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ClipboardList } from "lucide-react";
import { taskStatusVariant } from "@/lib/constants/status-colors";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectDetailClientProps {
  tasks: Task[];
  projectId: string;
}

const priorityLabels = ["P0", "P1", "P2", "P3"];

export function ProjectDetailClient({ tasks }: ProjectDetailClientProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        heading="No tasks yet"
        description="Create a task and assign it to this project."
      />
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Tasks ({tasks.length})
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <Link key={task.id} href={`/dashboard?task=${task.id}`}>
            <Card className="p-3 cursor-pointer transition-colors hover:bg-accent/50">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-6">
                  {priorityLabels[task.priority] ?? "P3"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {task.description}
                    </p>
                  )}
                </div>
                <Badge variant={taskStatusVariant[task.status] ?? "secondary"} className="text-xs">
                  {task.status}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
