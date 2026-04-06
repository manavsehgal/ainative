"use client";

import Link from "next/link";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIER_LABELS, type LicenseTier } from "@/lib/license/tier-limits";

interface ScheduleGateDialogProps {
  open: boolean;
  onClose: () => void;
  current: number;
  max: number;
  requiredTier: string;
}

/**
 * Modal intercept when a Community user tries to create a schedule
 * past their limit. Shows clear messaging and an upgrade path.
 */
export function ScheduleGateDialog({
  open,
  onClose,
  current,
  max,
  requiredTier,
}: ScheduleGateDialogProps) {
  const tierLabel = TIER_LABELS[requiredTier as LicenseTier] ?? requiredTier;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-muted-foreground" />
            <DialogTitle>Schedule limit reached</DialogTitle>
          </div>
          <DialogDescription>
            You have {current} of {max} active schedules on the{" "}
            {TIER_LABELS.community} tier. Upgrade to {tierLabel} for up to{" "}
            {requiredTier === "scale" ? "unlimited" : "more"} active schedules.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button asChild>
            <Link href={`/settings?highlight=${requiredTier}`}>
              Upgrade to {tierLabel}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
