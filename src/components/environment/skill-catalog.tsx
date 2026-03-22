"use client";

import { useState } from "react";
import { Search, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PersonaIndicator } from "./persona-indicator";
import { SkillDriftIndicator } from "./skill-drift-indicator";
import { SkillDetailSheet } from "./skill-detail-sheet";
import type { AggregatedSkill } from "@/lib/environment/skill-portfolio";

interface SkillCatalogProps {
  skills: AggregatedSkill[];
}

export function SkillCatalog({ skills }: SkillCatalogProps) {
  const [search, setSearch] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<AggregatedSkill | null>(null);

  const filtered = skills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const driftedCount = skills.filter((s) => s.driftStatus === "drifted").length;
  const sharedCount = skills.filter((s) => s.locations.length > 1).length;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{skills.length} unique skills</span>
        <span>{sharedCount} shared across locations</span>
        {driftedCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {driftedCount} drifted
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          heading="No skills found"
          description={search ? "Try a different search term." : "Scan your environment to discover skills."}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const primary = skill.locations[0];
            return (
              <Card
                key={skill.name}
                className="elevation-1 cursor-pointer hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                onClick={() => setSelectedSkill(skill)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSkill(skill);
                  }
                }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{skill.name}</span>
                    </div>
                    <SkillDriftIndicator status={skill.driftStatus} />
                  </div>

                  {primary?.preview && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {primary.preview}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {skill.toolPresence.map((tool) => (
                      <PersonaIndicator key={tool} tool={tool} size="sm" />
                    ))}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {skill.locations.length} location{skill.locations.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SkillDetailSheet
        skill={selectedSkill}
        open={!!selectedSkill}
        onOpenChange={(open) => {
          if (!open) setSelectedSkill(null);
        }}
      />
    </div>
  );
}
