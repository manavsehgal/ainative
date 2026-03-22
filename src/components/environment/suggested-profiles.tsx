"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bot, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileCreateDialog } from "./profile-create-dialog";
import type { ProfileSuggestion } from "@/lib/environment/profile-rules";

interface SuggestedProfilesProps {
  scanId?: string;
}

export function SuggestedProfiles({ scanId }: SuggestedProfilesProps) {
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ProfileSuggestion | null>(null);

  useEffect(() => {
    if (!scanId) { setLoading(false); return; }

    fetch(`/api/environment/profiles/suggest?scanId=${scanId}`)
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [scanId]);

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Suggested Profiles</h3>
        <Badge variant="secondary" className="text-[10px]">
          {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestions.map((suggestion) => (
          <Card
            key={suggestion.ruleId}
            className="elevation-1 hover:border-primary/40 transition-colors"
          >
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{suggestion.name}</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0"
                >
                  {Math.round(suggestion.confidence * 100)}%
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2">
                {suggestion.description}
              </p>

              <div className="flex flex-wrap gap-1">
                {suggestion.matchedArtifacts.map((a, i) => (
                  <Badge key={`${a.id}-${i}`} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {a.name}
                  </Badge>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setSelectedSuggestion(suggestion)}
              >
                Create Profile
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
