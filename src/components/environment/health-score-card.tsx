"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/lib/environment/health-scoring";

interface HealthScoreCardProps {
  health: HealthScore;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Work";
  return "At Risk";
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function HealthScoreCard({ health }: HealthScoreCardProps) {
  return (
    <Card className="elevation-1">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-muted-foreground" />
            Environment Health
          </span>
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-bold", getScoreColor(health.overall))}>
              {health.overall}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px]", getScoreColor(health.overall))}
            >
              {getScoreLabel(health.overall)}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Dimension bars */}
        {health.dimensions.map((dim) => (
          <div key={dim.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{dim.name}</span>
              <span className={cn("font-medium", getScoreColor(dim.score))}>
                {dim.score}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getBarColor(dim.score))}
                style={{ width: `${dim.score}%` }}
              />
            </div>
          </div>
        ))}

        {/* Top recommendations */}
        {health.recommendations.length > 0 && (
          <div className="pt-2 border-t space-y-1">
            {health.recommendations.slice(0, 3).map((rec, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">
                {rec}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
