"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    taskCount: number;
  };
  onEdit: (id: string) => void;
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
};

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => onEdit(project.id)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{project.name}</CardTitle>
        <Badge variant={statusVariant[project.status] ?? "secondary"}>
          {project.status}
        </Badge>
      </CardHeader>
      <CardContent>
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {project.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FolderKanban className="h-3 w-3" />
          <span>{project.taskCount} tasks</span>
        </div>
      </CardContent>
    </Card>
  );
}
