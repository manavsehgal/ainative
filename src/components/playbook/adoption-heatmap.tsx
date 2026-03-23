"use client";

import Link from "next/link";
import type { DocSection, AdoptionEntry } from "@/lib/docs/types";

interface AdoptionHeatmapProps {
  sections: DocSection[];
  adoption: Record<string, AdoptionEntry>;
}

const depthStyles: Record<AdoptionEntry["depth"], string> = {
  none: "bg-muted border-border/30 text-muted-foreground",
  light: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  deep: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
};

const depthLabels: Record<AdoptionEntry["depth"], string> = {
  none: "Not explored",
  light: "Lightly used",
  deep: "Deeply used",
};

export function AdoptionHeatmap({
  sections,
  adoption,
}: AdoptionHeatmapProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-muted-foreground uppercase tracking-wider">
          Feature Adoption
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            Not explored
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Light
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Deep
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {sections.map((section) => {
          const entry = adoption[section.slug] ?? {
            adopted: false,
            depth: "none" as const,
          };

          return (
            <Link
              key={section.slug}
              href={`/user-guide/${section.slug}`}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${depthStyles[entry.depth]}`}
              title={depthLabels[entry.depth]}
            >
              {section.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
