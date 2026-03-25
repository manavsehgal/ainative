"use client";

import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChapterGeneration } from "@/hooks/use-chapter-generation";

interface ChapterGenerationBarProps {
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  hasContent: boolean;
  onComplete: () => void;
}

/** Compact bar for chapter generation/regeneration with staleness indicator */
export function ChapterGenerationBar({
  chapterId,
  chapterTitle,
  chapterNumber,
  hasContent,
  onComplete,
}: ChapterGenerationBarProps) {
  const {
    staleness,
    isStale,
    isGenerating,
    progressMessage,
    error,
    triggerGeneration,
  } = useChapterGeneration({ chapterId, onComplete });

  // Format staleness as relative time
  const stalenessLabel = formatStaleness(staleness?.latestSourceChange ?? null);

  return (
    <div className="flex flex-col gap-2 mt-4">
      <div className="flex items-center gap-3">
        {isGenerating ? (
          /* State B: Generating */
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span key={progressMessage} className="animate-fade-in">
              {progressMessage}
            </span>
          </div>
        ) : (
          /* State A: Idle — show generate/regenerate button */
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerGeneration}
              className="gap-1.5 text-xs"
            >
              {hasContent ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate chapter
                </>
              )}
            </Button>

            {/* Staleness badge — only when stale */}
            {isStale && stalenessLabel && (
              <Badge variant="outline" className="text-xs font-normal gap-1 text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Sources updated {stalenessLabel}
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Progress pulse bar while generating */}
      {isGenerating && (
        <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-primary/40 animate-pulse-slide" />
        </div>
      )}

      {/* Error state */}
      {error && !isGenerating && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

/** Format an ISO timestamp as relative time (e.g., "3 days ago") */
function formatStaleness(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;

  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} months ago`;
}
