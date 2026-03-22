"use client";

import { useState } from "react";
import { ArrowRightLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import { SyncPreviewDialog } from "./sync-preview-dialog";

interface SyncActionButtonsProps {
  artifact: EnvironmentArtifactRow;
}

export function SyncActionButtons({ artifact }: SyncActionButtonsProps) {
  const [previewTarget, setPreviewTarget] = useState<string | null>(null);

  // Determine which tools this can sync TO
  const canSyncTo: Array<{ tool: string; label: string }> = [];

  if (artifact.tool === "claude-code" || artifact.tool === "shared") {
    canSyncTo.push({ tool: "codex", label: "Sync to Codex" });
  }
  if (artifact.tool === "codex" || artifact.tool === "shared") {
    canSyncTo.push({ tool: "claude-code", label: "Sync to Claude" });
  }

  // Only show sync for categories that support it
  const syncableCategories = ["skill", "mcp-server", "instruction", "hook"];
  if (!syncableCategories.includes(artifact.category)) {
    return null;
  }

  if (canSyncTo.length === 0) return null;

  return (
    <>
      <div className="flex gap-2">
        {canSyncTo.map(({ tool, label }) => (
          <Button
            key={tool}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPreviewTarget(tool)}
          >
            <ArrowRightLeft className="h-3 w-3 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {previewTarget && (
        <SyncPreviewDialog
          artifact={artifact}
          targetTool={previewTarget}
          open={!!previewTarget}
          onOpenChange={(open) => {
            if (!open) setPreviewTarget(null);
          }}
        />
      )}
    </>
  );
}
