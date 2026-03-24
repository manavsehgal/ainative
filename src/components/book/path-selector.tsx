"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { READING_PATHS } from "@/lib/book/reading-paths";

interface PathSelectorProps {
  activePath: string | null;
  recommendedPath: string | null;
  onSelectPath: (pathId: string | null) => void;
}

export function PathSelector({ activePath, recommendedPath, onSelectPath }: PathSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant={activePath === null ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs"
        onClick={() => onSelectPath(null)}
      >
        All Chapters
      </Button>
      {READING_PATHS.map((path) => (
        <Button
          key={path.id}
          variant={activePath === path.id ? "default" : "outline"}
          size="sm"
          className={cn("h-7 text-xs gap-1")}
          onClick={() => onSelectPath(path.id)}
        >
          {path.name}
          {recommendedPath === path.id && activePath !== path.id && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
              Recommended
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
