"use client";

import Link from "next/link";
import { Image, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { DocSection, AdoptionEntry } from "@/lib/docs/types";

interface PlaybookCardProps {
  section: DocSection;
  adoption?: AdoptionEntry;
}

function adoptionDot(adoption?: AdoptionEntry) {
  if (!adoption || adoption.depth === "none") {
    return (
      <span
        className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30"
        title="Not explored"
      />
    );
  }
  if (adoption.depth === "light") {
    return (
      <span
        className="h-2.5 w-2.5 rounded-full bg-amber-500"
        title="Lightly explored"
      />
    );
  }
  return (
    <span
      className="h-2.5 w-2.5 rounded-full bg-emerald-500"
      title="Deeply explored"
    />
  );
}

export function PlaybookCard({ section, adoption }: PlaybookCardProps) {
  const isAppRoute =
    section.route !== "cross-cutting" && section.route.startsWith("/");

  return (
    <Link
      href={`/user-guide/${section.slug}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <Card className="surface-card group h-full transition-colors hover:border-border-strong hover:bg-accent/50 rounded-lg">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {adoptionDot(adoption)}
              <h3 className="text-base font-medium truncate group-hover:text-primary transition-colors">
                {section.title}
              </h3>
            </div>
            {isAppRoute ? (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {section.route}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-xs">
                <ExternalLink className="h-3 w-3 mr-0.5" />
                cross-cutting
              </Badge>
            )}
          </div>
          {/* Subtitle: feature count */}
          <p className="text-sm text-muted-foreground">
            {section.features.length} feature
            {section.features.length !== 1 ? "s" : ""} covered
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {section.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
            {section.tags.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{section.tags.length - 4}
              </span>
            )}
          </div>

          {/* Footer */}
          {section.screengrabCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Image className="h-3.5 w-3.5" />
              {section.screengrabCount} screenshot
              {section.screengrabCount > 1 ? "s" : ""}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
