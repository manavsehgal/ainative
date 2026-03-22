"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Check, AlertTriangle, Loader2 } from "lucide-react";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";

interface PreviewData {
  previews: Array<{
    artifactName: string;
    category: string;
    targetPath: string;
    hasConflict: boolean;
    diff: { diff: string; additions: number; deletions: number; identical: boolean };
    syncOp: { isNew: boolean };
  }>;
  summary: {
    total: number;
    conflicts: number;
    newFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  };
}

interface SyncPreviewDialogProps {
  artifact: EnvironmentArtifactRow;
  targetTool: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncPreviewDialog({
  artifact,
  targetTool,
  open,
  onOpenChange,
}: SyncPreviewDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ applied: number; failed: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setResult(null);

    fetch("/api/environment/sync/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operations: [
          {
            artifactId: artifact.id,
            operation: "sync",
            targetTool,
          },
        ],
      }),
    })
      .then((res) => res.json())
      .then((data) => setPreview(data))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [open, artifact.id, targetTool]);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/environment/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operations: [
            {
              artifactId: artifact.id,
              operation: "sync",
              targetTool,
            },
          ],
          label: `Sync ${artifact.name} to ${targetTool}`,
        }),
      });
      const data = await res.json();
      setResult(data.summary);
      router.refresh();
    } finally {
      setExecuting(false);
    }
  };

  const toolLabel = targetTool === "codex" ? "Codex" : "Claude Code";
  const previewItem = preview?.previews?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Sync to {toolLabel}
          </DialogTitle>
          <DialogDescription>
            {artifact.name} ({artifact.category})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && previewItem && (
            <>
              {/* Target path */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Target</p>
                <code className="text-xs bg-muted rounded px-2 py-1 block truncate">
                  {previewItem.targetPath}
                </code>
              </div>

              {/* Status badges */}
              <div className="flex gap-2">
                {previewItem.syncOp.isNew && (
                  <Badge variant="default" className="text-xs">New file</Badge>
                )}
                {previewItem.hasConflict && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Conflict
                  </Badge>
                )}
                {previewItem.diff.identical && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Check className="h-3 w-3" />
                    Already in sync
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  +{previewItem.diff.additions} -{previewItem.diff.deletions}
                </Badge>
              </div>

              {/* Diff preview */}
              {previewItem.diff.diff && (
                <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre max-h-48 font-mono">
                  {previewItem.diff.diff}
                </pre>
              )}

              {/* Result */}
              {result && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800 p-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="h-4 w-4" />
                    Sync complete: {result.applied} applied, {result.failed} failed
                  </p>
                </div>
              )}
            </>
          )}

          {!loading && !previewItem && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Unable to generate preview for this artifact.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && previewItem && !previewItem.diff.identical && (
            <Button onClick={handleExecute} disabled={executing || loading}>
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                "Apply Sync"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
