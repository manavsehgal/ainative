import { Bell, Calendar, Hand } from "lucide-react";
import type { TriggerSource } from "@/lib/apps/view-kits/types";
import { Badge } from "@/components/ui/badge";

interface TriggerSourceChipProps {
  trigger: TriggerSource;
}

export function TriggerSourceChip({ trigger }: TriggerSourceChipProps) {
  if (trigger.kind === "row-insert") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Bell className="h-3 w-3" aria-hidden="true" />
        <span className="text-xs">
          Triggered by row insert in {trigger.table}
        </span>
      </Badge>
    );
  }
  if (trigger.kind === "schedule") {
    return (
      <Badge variant="outline" className="gap-1.5">
        <Calendar className="h-3 w-3" aria-hidden="true" />
        <span className="text-xs">Scheduled</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1.5">
      <Hand className="h-3 w-3" aria-hidden="true" />
      <span className="text-xs">Manual</span>
    </Badge>
  );
}
