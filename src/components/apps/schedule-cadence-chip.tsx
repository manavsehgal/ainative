import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScheduleCadenceChipProps {
  humanLabel: string | null;
  nextFireMs: number | null;
}

/**
 * Compact "daily 8pm · in 2d 4h" chip for the kit header. Pure presentation
 * — the human cron label and next-fire ms are computed upstream (data.ts via
 * `humanizeCron` + `schedules.nextFireAt`). Click-to-edit is deferred to a
 * later phase; today the chip is information-only.
 */
export function ScheduleCadenceChip({
  humanLabel,
  nextFireMs,
}: ScheduleCadenceChipProps) {
  if (!humanLabel) return null;
  const suffix = nextFireMs == null ? null : relativeSuffix(nextFireMs);
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Clock className="h-3 w-3" />
      <span>{humanLabel}</span>
      {suffix && <span className="text-muted-foreground">· {suffix}</span>}
    </Badge>
  );
}

function relativeSuffix(epochMs: number): string {
  const diff = epochMs - Date.now();
  if (diff <= 0) return "overdue";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days >= 1) return hours > 0 ? `in ${days}d ${hours}h` : `in ${days}d`;
  if (hours >= 1) return `in ${hours}h`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `in ${minutes}m`;
}
