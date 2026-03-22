"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import { CATEGORY_META } from "./summary-cards-row";
import { PersonaIndicator } from "./persona-indicator";

interface ArtifactCardProps {
  artifact: EnvironmentArtifactRow;
  onClick: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const meta = CATEGORY_META[artifact.category];
  const Icon = meta?.icon;

  return (
    <Card
      className="elevation-1 cursor-pointer hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: icon + name */}
        <div className="flex items-start gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
          <span className="font-medium text-sm truncate">{artifact.name}</span>
        </div>

        {/* Preview */}
        {artifact.preview && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {artifact.preview}
          </p>
        )}

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {meta?.label || artifact.category}
          </Badge>
          <PersonaIndicator tool={artifact.tool} size="sm" />
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {artifact.scope}
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatSize(artifact.sizeBytes)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
