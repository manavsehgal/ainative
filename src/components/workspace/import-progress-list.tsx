"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Loader2, Circle } from "lucide-react";

export interface ImportProjectStatus {
  name: string;
  status: "pending" | "creating" | "done" | "failed";
  artifactCount?: number;
  error?: string;
}

interface ImportProgressListProps {
  projects: ImportProjectStatus[];
  created: number;
  failed: number;
  total: number;
  complete: boolean;
}

export function ImportProgressList({
  projects,
  created,
  failed,
  total,
  complete,
}: ImportProgressListProps) {
  const processed = created + failed;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {complete
              ? `Import complete`
              : `Importing ${processed}/${total}...`}
          </span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="h-2" />
        {complete && (
          <p className="text-xs text-muted-foreground">
            {created} created{failed > 0 ? `, ${failed} failed` : ""}
          </p>
        )}
      </div>

      {/* Project list */}
      <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
        {projects.map((project, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm"
          >
            {/* Status icon */}
            {project.status === "done" && (
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
            {project.status === "failed" && (
              <X className="h-4 w-4 text-destructive shrink-0" />
            )}
            {project.status === "creating" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            )}
            {project.status === "pending" && (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}

            {/* Name */}
            <span className="truncate flex-1">{project.name}</span>

            {/* Result badge */}
            {project.status === "done" && project.artifactCount !== undefined && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {project.artifactCount} artifacts
              </Badge>
            )}
            {project.status === "failed" && project.error && (
              <span className="text-[11px] text-destructive truncate max-w-[200px]">
                {project.error}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
