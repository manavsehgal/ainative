"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch } from "lucide-react";

interface BranchActionButtonProps {
  parentConversationId: string;
  branchedFromMessageId: string;
  parentTitle?: string | null;
  onBranch: (input: {
    parentConversationId: string;
    branchedFromMessageId: string;
    title: string;
  }) => Promise<string | null>;
}

export function BranchActionButton({
  parentConversationId,
  branchedFromMessageId,
  parentTitle,
  onBranch,
}: BranchActionButtonProps) {
  const defaultTitle = `${parentTitle || "Conversation"} — branch`;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (next) setTitle(defaultTitle);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await onBranch({
      parentConversationId,
      branchedFromMessageId,
      title: title.trim() || defaultTitle,
    });
    setSubmitting(false);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => handleOpen(true)}
        aria-label="Branch from here"
      >
        <GitBranch className="h-3.5 w-3.5" />
        Branch
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Branch from here</DialogTitle>
            <DialogDescription>
              Forks the conversation at this assistant message. The new branch
              keeps the prior history; you continue from there.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="branch-title">Branch title</Label>
            <Input
              id="branch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              Create branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
