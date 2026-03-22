"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import { PersonaIndicator } from "./persona-indicator";
import { CATEGORY_META } from "./summary-cards-row";
import { SyncActionButtons } from "./sync-action-buttons";

interface ArtifactDetailSheetProps {
  artifact: EnvironmentArtifactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtifactDetailSheet({
  artifact,
  open,
  onOpenChange,
}: ArtifactDetailSheetProps) {
  if (!artifact) return null;

  const meta = CATEGORY_META[artifact.category];
  const Icon = meta?.icon;
  const parsedMetadata = artifact.metadata ? JSON.parse(artifact.metadata) : {};

  const copyPath = () => {
    navigator.clipboard.writeText(artifact.absPath);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            <SheetTitle className="truncate">{artifact.name}</SheetTitle>
          </div>
          <SheetDescription>
            {meta?.label || artifact.category} artifact
          </SheetDescription>
        </SheetHeader>

        {/* Body — MUST have px-6 pb-6 padding (project convention) */}
        <div className="px-6 pb-6 space-y-5 overflow-y-auto">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{meta?.label || artifact.category}</Badge>
            <PersonaIndicator tool={artifact.tool} size="md" />
            <Badge variant="secondary">{artifact.scope}</Badge>
            <Badge variant="outline" className="text-xs">
              {formatSize(artifact.sizeBytes)}
            </Badge>
          </div>

          {/* Sync actions */}
          <SyncActionButtons artifact={artifact} />

          {/* File path */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Path</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted rounded px-2 py-1 flex-1 truncate">
                {artifact.absPath}
              </code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyPath}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Relative: {artifact.relPath}
            </p>
          </div>

          {/* Metadata */}
          {Object.keys(parsedMetadata).length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Metadata</p>
              <div className="bg-muted rounded-lg p-3 space-y-1">
                {Object.entries(parsedMetadata).map(([key, value]) => (
                  <div key={key} className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium text-muted-foreground shrink-0">{key}:</span>
                    <span className="truncate">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {artifact.preview && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
                {artifact.preview}
              </pre>
            </div>
          )}

          {/* Technical details */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Details</p>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-muted-foreground">Content Hash</span>
              <code className="truncate">{artifact.contentHash.slice(0, 16)}...</code>
              <span className="text-muted-foreground">Last Modified</span>
              <span>{formatDate(artifact.modifiedAt)}</span>
              <span className="text-muted-foreground">Scanned At</span>
              <span>{artifact.createdAt.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
