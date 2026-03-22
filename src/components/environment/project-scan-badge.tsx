"use client";

import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectScanBadgeProps {
  hasWorkingDirectory: boolean;
  hasScan: boolean;
}

/**
 * Badge for project list showing environment scan status.
 * Shows "Not scanned" for projects with a workingDirectory but no scan.
 */
export function ProjectScanBadge({
  hasWorkingDirectory,
  hasScan,
}: ProjectScanBadgeProps) {
  if (!hasWorkingDirectory) return null;

  if (hasScan) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
        <Globe className="h-2.5 w-2.5" />
        Scanned
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 text-amber-600 dark:text-amber-400">
      <Globe className="h-2.5 w-2.5" />
      Not scanned
    </Badge>
  );
}
