"use client";

import { Badge } from "@/components/ui/badge";
import { scheduleStatusVariant } from "@/lib/constants/status-colors";

interface ScheduleStatusBadgeProps {
  status: string;
}

export function ScheduleStatusBadge({ status }: ScheduleStatusBadgeProps) {
  return (
    <Badge variant={scheduleStatusVariant[status] ?? "secondary"}>
      {status}
    </Badge>
  );
}
