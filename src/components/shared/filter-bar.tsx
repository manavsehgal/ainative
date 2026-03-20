"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface FilterBarProps {
  /** The filter controls (Select, Input, etc.) */
  children: ReactNode;
  /** Number of active (non-default) filters */
  activeCount?: number;
  /** Callback to clear all filters */
  onClear?: () => void;
  className?: string;
}

/**
 * FilterBar — horizontal filter controls with active count + clear button.
 *
 * Wrap your filter controls (Select, Input, etc.) in this component.
 * It adds a clear button and active filter count badge automatically.
 */
export function FilterBar({
  children,
  activeCount = 0,
  onClear,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "surface-toolbar rounded-lg p-3 flex flex-wrap items-center gap-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {children}
      </div>

      {activeCount > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {activeCount} active
          </Badge>
          {onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
