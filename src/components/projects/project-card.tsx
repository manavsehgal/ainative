"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, FolderOpen } from "lucide-react";
import { projectStatusVariant } from "@/lib/constants/status-colors";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    workingDirectory: string | null;
    status: string;
    taskCount: number;
  };
  onEdit: (id: string) => void;
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  return (
    <Card
      tabIndex={0}
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(project.id); } }}
      onClick={() => onEdit(project.id)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{project.name}</CardTitle>
        <Badge variant={projectStatusVariant[project.status] ?? "secondary"}>
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
        {project.workingDirectory && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <FolderOpen className="h-3 w-3" />
            <span className="truncate">{project.workingDirectory}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
