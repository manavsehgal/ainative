"use client";

import { AlignJustify, AlignCenter, AlignLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Density } from "@/components/data-table";

const densityOptions: { value: Density; icon: typeof AlignJustify; label: string }[] = [
  { value: "compact", icon: AlignJustify, label: "Compact" },
  { value: "comfortable", icon: AlignCenter, label: "Comfortable" },
  { value: "spacious", icon: AlignLeft, label: "Spacious" },
];

interface DensityToggleProps {
  density: Density;
  onDensityChange: (density: Density) => void;
}

/** Standalone density toggle — matches the DataTableToolbar style. */
export function DensityToggle({ density, onDensityChange }: DensityToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {densityOptions.map((opt) => (
        <Tooltip key={opt.value}>
          <TooltipTrigger asChild>
            <Button
              variant={density === opt.value ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => onDensityChange(opt.value)}
              aria-label={`${opt.label} density`}
            >
              <opt.icon className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {opt.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
