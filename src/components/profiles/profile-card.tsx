"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { listRuntimeCatalog } from "@/lib/agents/runtime/catalog";
import { getSupportedRuntimes } from "@/lib/agents/profiles/compatibility";
import { IconCircle, getProfileIcon, getDomainColors } from "@/lib/constants/card-icons";
import type { AgentProfile } from "@/lib/agents/profiles/types";

interface ProfileCardProps {
  profile: AgentProfile;
  isBuiltin?: boolean;
  onClick: () => void;
}

export function ProfileCard({ profile, isBuiltin = false, onClick }: ProfileCardProps) {
  const runtimeLabelMap = new Map(
    listRuntimeCatalog().map((runtime) => [
      runtime.id,
      runtime.label.includes("Codex") ? "Codex" : "Claude",
    ])
  );

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
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <IconCircle
          icon={getProfileIcon(profile.id)}
          colors={getDomainColors(profile.domain, isBuiltin)}
        />
        <div className="flex min-w-0 flex-1 items-center justify-between">
          <CardTitle className="truncate text-base font-medium">{profile.name}</CardTitle>
          <Badge
            variant={profile.domain === "work" ? "default" : "secondary"}
          >
            {profile.domain}
          </Badge>
        </div>
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

        <div className="flex flex-wrap gap-1">
          {getSupportedRuntimes(profile).map((runtimeId) => (
            <Badge key={runtimeId} variant="secondary" className="text-xs">
              {runtimeLabelMap.get(runtimeId) ?? runtimeId}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {profile.importMeta ? (
            <span className="flex items-center gap-1.5">
              <Badge variant="outline" className="border-purple-200 text-purple-600 dark:border-purple-800 dark:text-purple-400">
                <Download className="mr-1 h-3 w-3" />
                Imported
              </Badge>
              <span className="text-muted-foreground">
                {profile.importMeta.repoOwner}/{profile.importMeta.repoName}
              </span>
            </span>
          ) : isBuiltin ? (
            <Badge variant="outline" className="border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400">
              Built-in
            </Badge>
          ) : (
            <Badge variant="outline" className="border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Custom
            </Badge>
          )}
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
