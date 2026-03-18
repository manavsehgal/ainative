"use client";

import { PlaybookCard } from "./playbook-card";
import type { DocSection, AdoptionEntry } from "@/lib/docs/types";

interface RelatedDocsProps {
  sections: DocSection[];
  adoption: Record<string, AdoptionEntry>;
}

export function RelatedDocs({ sections, adoption }: RelatedDocsProps) {
  if (sections.length === 0) return null;

  return (
    <div className="space-y-3 pt-6 border-t border-border/50">
      <h3 className="text-base font-medium text-muted-foreground uppercase tracking-wider">
        Related Docs
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <PlaybookCard
            key={section.slug}
            section={section}
            adoption={adoption[section.slug]}
          />
        ))}
      </div>
    </div>
  );
}
