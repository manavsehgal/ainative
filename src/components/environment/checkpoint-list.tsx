"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  RotateCcw,
  Clock,
  GitBranch,
  FolderArchive,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { EnvironmentCheckpointRow } from "@/lib/db/schema";
import { RollbackConfirmDialog } from "./rollback-confirm-dialog";

interface CheckpointListProps {
  checkpoints: EnvironmentCheckpointRow[];
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_LABELS: Record<string, string> = {
  "pre-sync": "Pre-Sync",
  manual: "Manual",
  "pre-onboard": "Pre-Onboard",
};

export function CheckpointList({ checkpoints }: CheckpointListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [rollbackTarget, setRollbackTarget] =
    useState<EnvironmentCheckpointRow | null>(null);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      await fetch("/api/environment/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Manual checkpoint" }),
      });
      router.refresh();
    } finally {
      setCreating(false);
    }
  }, [router]);

  if (checkpoints.length === 0) {
    return (
      <EmptyState
        icon={Save}
        heading="No checkpoints yet"
        description="Create a checkpoint to snapshot your environment before making changes."
        action={
          <Button onClick={handleCreate} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? "Creating..." : "Create Checkpoint"}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""}
        </h3>
        <Button variant="outline" size="sm" onClick={handleCreate} disabled={creating}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {creating ? "Creating..." : "New Checkpoint"}
        </Button>
      </div>

      <div className="space-y-2">
        {checkpoints.map((cp) => (
          <Card key={cp.id} className="elevation-1">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Save className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{cp.label}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(cp.createdAt)}
                    </span>
                    {cp.gitCommitSha && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {cp.gitCommitSha.slice(0, 7)}
                      </span>
                    )}
                    {cp.backupPath && (
                      <span className="flex items-center gap-1">
                        <FolderArchive className="h-3 w-3" />
                        backup
                      </span>
                    )}
                    <span>{cp.filesCount} file{cp.filesCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={
                    cp.status === "active"
                      ? "default"
                      : cp.status === "rolled_back"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-[10px]"
                >
                  {cp.status}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {TYPE_LABELS[cp.checkpointType] || cp.checkpointType}
                </Badge>
                {cp.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setRollbackTarget(cp)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Rollback
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RollbackConfirmDialog
        checkpoint={rollbackTarget}
        open={!!rollbackTarget}
        onOpenChange={(open) => {
          if (!open) setRollbackTarget(null);
        }}
        onConfirm={async () => {
          if (!rollbackTarget) return;
          await fetch(`/api/environment/checkpoints/${rollbackTarget.id}`, {
            method: "POST",
          });
          setRollbackTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
