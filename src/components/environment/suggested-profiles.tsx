"use client";

import { useState, useEffect } from "react";
import { Bot, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileCreateDialog } from "./profile-create-dialog";
import type { ProfileSuggestion } from "@/lib/environment/profile-rules";

interface SuggestedProfilesProps {
  scanId?: string;
}

function SuggestionCard({
  suggestion,
  onSelect,
}: {
  suggestion: ProfileSuggestion;
  onSelect: () => void;
}) {
  return (
    <Card className="elevation-1 hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{suggestion.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {suggestion.tier === "discovered" && (
              <Badge variant="secondary" className="text-[10px]">
                Discovered
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {Math.round(suggestion.confidence * 100)}%
            </Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">
          {suggestion.description}
        </p>

        <div className="flex flex-wrap gap-1">
          {suggestion.matchedArtifacts.map((a, i) => (
            <Badge
              key={`${a.id}-${i}`}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {a.name}
            </Badge>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onSelect}
        >
          Create Profile
        </Button>
      </CardContent>
    </Card>
  );
}

export function SuggestedProfiles({ scanId }: SuggestedProfilesProps) {
  const [curated, setCurated] = useState<ProfileSuggestion[]>([]);
  const [discovered, setDiscovered] = useState<ProfileSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<ProfileSuggestion | null>(null);
  const [discoveredExpanded, setDiscoveredExpanded] = useState(false);

  useEffect(() => {
    if (!scanId) {
      setLoading(false);
      return;
    }

    fetch(`/api/environment/profiles/suggest?scanId=${scanId}&tiered=true`)
      .then((res) => res.json())
      .then((data) => {
        setCurated(data.curated || []);
        setDiscovered(data.discovered || []);
      })
      .catch(() => {
        setCurated([]);
        setDiscovered([]);
      })
      .finally(() => setLoading(false));
  }, [scanId]);

  const totalCount = curated.length + discovered.length;
  if (loading || totalCount === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Suggested Profiles</h3>
        <Badge variant="secondary" className="text-[10px]">
          {totalCount} suggestion{totalCount !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Tier 1: Curated suggestions */}
      {curated.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {curated.map((suggestion) => (
            <SuggestionCard
              key={suggestion.ruleId}
              suggestion={suggestion}
              onSelect={() => setSelectedSuggestion(suggestion)}
            />
          ))}
        </div>
      )}

      {/* Tier 2: Discovered suggestions (collapsible) */}
      {discovered.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setDiscoveredExpanded(!discoveredExpanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {discoveredExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {discovered.length} discoverable skill{discovered.length !== 1 ? "s" : ""}
          </button>

          {discoveredExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {discovered.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.ruleId}
                  suggestion={suggestion}
                  onSelect={() => setSelectedSuggestion(suggestion)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ProfileCreateDialog
        suggestion={selectedSuggestion}
        open={!!selectedSuggestion}
        onOpenChange={(open) => {
          if (!open) setSelectedSuggestion(null);
        }}
      />
    </div>
  );
}
