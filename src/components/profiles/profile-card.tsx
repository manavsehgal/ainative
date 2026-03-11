"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentProfile } from "@/lib/agents/profiles/types";

interface ProfileCardProps {
  profile: AgentProfile;
  onClick: () => void;
}

export function ProfileCard({ profile, onClick }: ProfileCardProps) {
  return (
    <Card
      tabIndex={0}
      role="button"
      className="surface-card cursor-pointer rounded-xl transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{profile.name}</CardTitle>
        <Badge
          variant={profile.domain === "work" ? "default" : "secondary"}
        >
          {profile.domain}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {profile.description}
        </p>

        {profile.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {profile.version && <span>v{profile.version}</span>}
          {profile.allowedTools && profile.allowedTools.length > 0 && (
            <span>
              {profile.allowedTools.length} tool
              {profile.allowedTools.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
