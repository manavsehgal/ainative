"use client";

import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Rocket,
  Crown,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaybookBrowser } from "./playbook-browser";
import { AdoptionHeatmap } from "./adoption-heatmap";
import type {
  DocManifest,
  UsageStage,
  AdoptionEntry,
  JourneyCompletion,
} from "@/lib/docs/types";

interface PlaybookHomepageProps {
  manifest: DocManifest;
  stage: UsageStage;
  adoption: Record<string, AdoptionEntry>;
  journeyCompletions: Record<string, JourneyCompletion>;
  hasUpdates: boolean;
}

const stageConfig: Record<
  UsageStage,
  {
    icon: typeof BookOpen;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaSlug: string;
  }
> = {
  new: {
    icon: BookOpen,
    title: "Welcome to Stagent",
    subtitle:
      "Your AI agent orchestrator. Start with the getting started guide or explore feature docs at your own pace.",
    ctaLabel: "Getting Started",
    ctaSlug: "getting-started",
  },
  early: {
    icon: Sparkles,
    title: "Keep Building",
    subtitle:
      "You've started creating tasks. Follow a guided journey to unlock more of what Stagent can do.",
    ctaLabel: "Personal Use Guide",
    ctaSlug: "personal-use",
  },
  active: {
    icon: Rocket,
    title: "Level Up",
    subtitle:
      "You're actively using Stagent. Explore advanced workflows, schedules, and multi-agent features.",
    ctaLabel: "Power User Guide",
    ctaSlug: "power-user",
  },
  power: {
    icon: Crown,
    title: "Master Mode",
    subtitle:
      "You've unlocked the full platform. Dive into cross-cutting guides and developer docs.",
    ctaLabel: "Developer Guide",
    ctaSlug: "developer",
  },
};

export function PlaybookHomepage({
  manifest,
  stage,
  adoption,
  journeyCompletions,
  hasUpdates,
}: PlaybookHomepageProps) {
  const config = stageConfig[stage];
  const Icon = config.icon;

  const adoptedCount = Object.values(adoption).filter(
    (a) => a.adopted
  ).length;
  const totalSections = manifest.sections.length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="surface-panel rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {config.title}
                </h1>
                {hasUpdates && (
                  <Badge className="bg-primary/10 text-primary text-xs">
                    Updated
                  </Badge>
                )}
              </div>
              <p className="text-base text-muted-foreground max-w-lg">
                {config.subtitle}
              </p>
              {stage !== "new" && (
                <p className="text-sm text-muted-foreground">
                  {adoptedCount} of {totalSections} features explored
                </p>
              )}
            </div>
          </div>
          <Button asChild>
            <Link href={`/playbook/${config.ctaSlug}`}>
              {config.ctaLabel}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Adoption Heatmap — shown for active/power users */}
      {(stage === "active" || stage === "power") && (
        <AdoptionHeatmap sections={manifest.sections} adoption={adoption} />
      )}

      {/* Full Browser */}
      <PlaybookBrowser
        sections={manifest.sections}
        journeys={manifest.journeys}
        adoption={adoption}
        journeyCompletions={journeyCompletions}
      />
    </div>
  );
}
