"use client";
import { Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CommandItem } from "@/components/ui/command";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";

interface SkillRowProps {
  skill: EnrichedSkill;
  recommended?: boolean;
  onSelect: () => void;
}

function healthVariant(
  h: EnrichedSkill["healthScore"]
): "default" | "secondary" | "destructive" | "outline" {
  if (h === "healthy") return "default";
  if (h === "stale") return "outline";
  if (h === "aging" || h === "broken") return "destructive";
  return "secondary";
}

function syncLabel(s: EnrichedSkill["syncStatus"]): string {
  switch (s) {
    case "synced":
      return "synced";
    case "claude-only":
      return "claude-only";
    case "codex-only":
      return "codex-only";
    case "shared":
      return "shared";
  }
}

export function SkillRow({ skill, recommended, onSelect }: SkillRowProps) {
  const syncHref =
    skill.syncStatus !== "synced"
      ? `/environment?skill=${encodeURIComponent(skill.name)}`
      : null;

  return (
    <CommandItem
      key={skill.id}
      value={`${skill.name} ${skill.preview} ${skill.tool}`}
      onSelect={onSelect}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{skill.name}</span>
          {recommended && (
            <Star
              className="h-3 w-3 shrink-0 fill-amber-500 text-amber-500"
              aria-label="Recommended for this conversation"
            />
          )}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {skill.preview}
        </span>
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <Badge
            variant={healthVariant(skill.healthScore)}
            className="text-[10px]"
          >
            {skill.healthScore}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {syncLabel(skill.syncStatus)}
          </Badge>
          {skill.linkedProfileId && (
            <Badge variant="secondary" className="text-[10px]">
              {skill.linkedProfileId}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {skill.scope}
          </Badge>
        </div>
      </div>
      {syncHref && (
        <a
          href={syncHref}
          aria-label={`Open ${skill.name} in environment dashboard`}
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      )}
    </CommandItem>
  );
}
