"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PlaybookCard } from "@/components/playbook/playbook-card";
import { JourneyCard } from "@/components/playbook/journey-card";
import type {
  DocSection,
  DocJourney,
  AdoptionEntry,
  JourneyCompletion,
} from "@/lib/docs/types";

type CategoryFilter = "all" | "features" | "journeys" | "getting-started";

interface PlaybookBrowserProps {
  sections: DocSection[];
  journeys: DocJourney[];
  adoption: Record<string, AdoptionEntry>;
  journeyCompletions: Record<string, JourneyCompletion>;
}

export function PlaybookBrowser({
  sections,
  journeys,
  adoption,
  journeyCompletions,
}: PlaybookBrowserProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filteredSections = useMemo(() => {
    const q = search.toLowerCase();
    return sections.filter((s) => {
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        s.slug.toLowerCase().includes(q)
      );
    });
  }, [sections, search]);

  const filteredJourneys = useMemo(() => {
    const q = search.toLowerCase();
    return journeys.filter((j) => {
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.persona.toLowerCase().includes(q) ||
        j.slug.toLowerCase().includes(q)
      );
    });
  }, [journeys, search]);

  const showSections = category === "all" || category === "features";
  const showJourneys = category === "all" || category === "journeys";
  const isEmpty =
    (showSections ? filteredSections.length : 0) +
      (showJourneys ? filteredJourneys.length : 0) ===
    0;

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="surface-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search docs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="surface-control pl-9"
          />
        </div>
        <Tabs
          value={category}
          onValueChange={(v) => setCategory(v as CategoryFilter)}
        >
          <TabsList className="surface-control">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="journeys">Journeys</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={BookOpen}
          heading="No docs found"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="space-y-6">
          {/* Journeys */}
          {showJourneys && filteredJourneys.length > 0 && (
            <div className="space-y-3">
              {category === "all" && (
                <h3 className="text-base font-medium text-muted-foreground uppercase tracking-wider">
                  Guided Journeys
                </h3>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredJourneys.map((journey) => (
                  <JourneyCard
                    key={journey.slug}
                    journey={journey}
                    completion={journeyCompletions[journey.slug]}
                    adoption={adoption}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Feature Sections */}
          {showSections && filteredSections.length > 0 && (
            <div className="space-y-3">
              {category === "all" && (
                <h3 className="text-base font-medium text-muted-foreground uppercase tracking-wider">
                  Feature Reference
                </h3>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredSections.map((section) => (
                  <PlaybookCard
                    key={section.slug}
                    section={section}
                    adoption={adoption[section.slug]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
