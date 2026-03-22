"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, GitBranch, FolderArchive } from "lucide-react";
import type { EnvironmentCheckpointRow } from "@/lib/db/schema";

interface RollbackConfirmDialogProps {
  checkpoint: EnvironmentCheckpointRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function RollbackConfirmDialog({
  checkpoint,
  open,
  onOpenChange,
  onConfirm,
}: RollbackConfirmDialogProps) {
  const [rolling, setRolling] = useState(false);

  if (!checkpoint) return null;

  const handleConfirm = async () => {
    setRolling(true);
    try {
      await onConfirm();
    } finally {
      setRolling(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" />
            Rollback to Checkpoint
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will restore your environment to the state captured in:{" "}
                <strong>{checkpoint.label}</strong>
              </p>

              <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
                {checkpoint.gitCommitSha && (
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Git: checkout commit{" "}
                      <code className="text-xs">{checkpoint.gitCommitSha.slice(0, 7)}</code>{" "}
                      and create a new rollback commit
                    </span>
                  </div>
                )}
                {checkpoint.backupPath && (
                  <div className="flex items-center gap-2">
                    <FolderArchive className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Global files: restore from backup to original locations
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {checkpoint.filesCount} file{checkpoint.filesCount !== 1 ? "s" : ""}
                  </Badge>
                  <span className="text-muted-foreground">will be affected</span>
                </div>
              </div>

              <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                This action creates a new commit — it does not rewrite history.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={rolling}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={rolling}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {rolling ? "Rolling back..." : "Confirm Rollback"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
