"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import { PersonaIndicator } from "./persona-indicator";
import { SkillDriftIndicator } from "./skill-drift-indicator";
import type { AggregatedSkill } from "@/lib/environment/skill-portfolio";

interface SkillDetailSheetProps {
  skill: AggregatedSkill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillDetailSheet({ skill, open, onOpenChange }: SkillDetailSheetProps) {
  if (!skill) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <SheetTitle>{skill.name}</SheetTitle>
          </div>
          <SheetDescription>
            {skill.locations.length} location{skill.locations.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Body — px-6 pb-6 padding (project convention) */}
        <div className="px-6 pb-6 space-y-5 overflow-y-auto">
          {/* Drift status */}
          <div className="flex items-center gap-3">
            <SkillDriftIndicator status={skill.driftStatus} />
            <div className="flex gap-1.5">
              {skill.toolPresence.map((tool) => (
                <PersonaIndicator key={tool} tool={tool} size="md" />
              ))}
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Locations</p>
            {skill.locations.map((loc) => (
              <div key={loc.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <PersonaIndicator tool={loc.tool} size="sm" />
                  <Badge variant="secondary" className="text-[10px]">
                    {loc.scope}
                  </Badge>
                </div>
                <code className="text-xs text-muted-foreground block truncate">
                  {loc.absPath}
                </code>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Hash: {loc.contentHash.slice(0, 12)}...</span>
                  <span>{loc.sizeBytes} B</span>
                </div>
              </div>
            ))}
          </div>

          {/* Preview from first location */}
          {skill.locations[0]?.preview && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48">
                {skill.locations[0].preview}
              </pre>
            </div>
          )}

          {/* Drift diff (show when drifted) */}
          {skill.driftStatus === "drifted" && skill.locations.length >= 2 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Content differs between locations
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-muted rounded p-2">
                  <p className="font-medium mb-1">{skill.locations[0].tool}</p>
                  <p>Hash: {skill.locations[0].contentHash.slice(0, 16)}</p>
                  <p>{skill.locations[0].sizeBytes} bytes</p>
                </div>
                <div className="bg-muted rounded p-2">
                  <p className="font-medium mb-1">{skill.locations[1].tool}</p>
                  <p>Hash: {skill.locations[1].contentHash.slice(0, 16)}</p>
                  <p>{skill.locations[1].sizeBytes} bytes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
