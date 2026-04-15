"use client";

/**
 * SkillCompositionConflictDialog — surfaces conflict excerpts when the
 * user tries to compose two skills whose directives diverge.
 *
 * Triggered by `chat-command-popover.tsx` when `activate_skill mode:"add"`
 * returns `{ requiresConfirmation: true, conflicts: [...] }`. Confirming
 * re-issues the same call with `force: true`.
 *
 * See `features/chat-composition-ui-v1.md`.
 */

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SkillConflict } from "@/lib/chat/skill-conflict";

interface SkillCompositionConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Skill the user is trying to add (display label). */
  newSkillName: string;
  conflicts: SkillConflict[];
  /** Called when user clicks "Add anyway" — issues the force:true retry. */
  onConfirm: () => void;
}

export function SkillCompositionConflictDialog({
  open,
  onOpenChange,
  newSkillName,
  conflicts,
  onConfirm,
}: SkillCompositionConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Conflict detected
          </DialogTitle>
          <DialogDescription>
            Adding{" "}
            <span className="font-mono text-foreground">{newSkillName}</span>{" "}
            may conflict with {conflicts.length === 1 ? "an active skill" : "active skills"}.
            Review the directives below and decide whether to add anyway.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-3 px-1">
          {conflicts.map((c, idx) => (
            <div
              key={`${c.skillA}-${c.skillB}-${idx}`}
              className="rounded-md border bg-muted/30 p-3 text-xs space-y-2"
            >
              <div className="text-muted-foreground">
                Topic: <span className="font-mono text-foreground">{c.sharedTopic}</span>
              </div>
              <div>
                <span className="font-semibold">{c.skillA}:</span>{" "}
                <span className="italic">"{c.excerptA}"</span>
              </div>
              <div>
                <span className="font-semibold">{c.skillB}:</span>{" "}
                <span className="italic">"{c.excerptB}"</span>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Add anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
