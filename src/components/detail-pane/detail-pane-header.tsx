import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/shared/status-chip";
import type { StatusFamily } from "@/lib/constants/status-families";
import type { ReactNode } from "react";

interface DetailPaneHeaderProps {
  icon?: LucideIcon;
  title: string;
  status?: string;
  statusFamily?: StatusFamily;
  actions?: ReactNode;
  onClose: () => void;
}

/**
 * Standardized header for the detail pane.
 * Shows: icon + title + status chip + actions + close button.
 */
export function DetailPaneHeader({
  icon: Icon,
  title,
  status,
  statusFamily,
  actions,
  onClose,
}: DetailPaneHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border p-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{title}</h2>
        </div>
        {status && <StatusChip status={status} family={statusFamily} />}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {actions}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close detail pane"
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
