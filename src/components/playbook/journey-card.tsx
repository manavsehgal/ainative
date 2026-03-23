"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Map, Clock, GraduationCap, Briefcase, Zap, Code } from "lucide-react";
import type {
  DocJourney,
  AdoptionEntry,
  JourneyCompletion,
} from "@/lib/docs/types";

const personaIcons: Record<string, typeof Map> = {
  personal: GraduationCap,
  work: Briefcase,
  "power-user": Zap,
  developer: Code,
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  advanced: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

interface JourneyCardProps {
  journey: DocJourney;
  completion?: JourneyCompletion;
  adoption: Record<string, AdoptionEntry>;
}

export function JourneyCard({
  journey,
  completion,
  adoption,
}: JourneyCardProps) {
  const Icon = personaIcons[journey.persona] || Map;
  const completed = completion?.completed ?? 0;
  const total = completion?.total ?? journey.sections.length;
  const percentage = completion?.percentage ?? 0;

  return (
    <Link
      href={`/user-guide/${journey.slug}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="surface-card group h-full transition-colors hover:border-border-strong hover:bg-accent/50 rounded-lg">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-medium group-hover:text-primary transition-colors">
                  {journey.title}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant="outline"
                    className={`text-xs ${difficultyColors[journey.difficulty] || ""}`}
                  >
                    {journey.difficulty}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {journey.stepCount} steps
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Progress bar — segmented by section */}
          <div className="flex gap-1">
            {journey.sections.map((sectionSlug) => {
              const sectionAdoption = adoption[sectionSlug];
              const isAdopted = sectionAdoption?.adopted === true;
              const depth = sectionAdoption?.depth ?? "none";

              let barColor = "bg-muted-foreground/20";
              if (depth === "deep") barColor = "bg-emerald-500";
              else if (depth === "light") barColor = "bg-amber-500";

              return (
                <div
                  key={sectionSlug}
                  className={`h-2 flex-1 rounded-full ${barColor} transition-colors`}
                  title={`${sectionSlug}: ${isAdopted ? "explored" : "not explored"}`}
                />
              );
            })}
          </div>

          {/* Completion label */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completed} of {total} explored
            </span>
            <span className="font-medium">
              {percentage}%
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
