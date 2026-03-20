"use client";

import { AlignJustify, AlignCenter, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Density } from "./data-table";
import type { ReactNode } from "react";

interface DataTableToolbarProps {
  density: Density;
  onDensityChange: (density: Density) => void;
  showDensityToggle: boolean;
  selectedCount?: number;
  children?: ReactNode;
}

const densityOptions: { value: Density; icon: typeof AlignJustify; label: string }[] = [
  { value: "compact", icon: AlignJustify, label: "Compact" },
  { value: "comfortable", icon: AlignCenter, label: "Comfortable" },
  { value: "spacious", icon: AlignLeft, label: "Spacious" },
];

export function DataTableToolbar({
  density,
  onDensityChange,
  showDensityToggle,
  selectedCount,
  children,
}: DataTableToolbarProps) {
  const hasContent = children || showDensityToggle || (selectedCount !== undefined && selectedCount > 0);

  if (!hasContent) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {children}
        {selectedCount !== undefined && selectedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {selectedCount} selected
          </span>
        )}
      </div>

      {showDensityToggle && (
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {densityOptions.map((opt) => (
            <Tooltip key={opt.value}>
              <TooltipTrigger asChild>
                <Button
                  variant={density === opt.value ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onDensityChange(opt.value)}
                  aria-label={`${opt.label} density`}
                >
                  <opt.icon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {opt.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
