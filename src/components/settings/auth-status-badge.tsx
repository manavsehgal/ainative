"use client";

import { Badge } from "@/components/ui/badge";
import type { ApiKeySource } from "@/lib/constants/settings";

interface AuthStatusBadgeProps {
  connected: boolean;
  apiKeySource: ApiKeySource;
}

const sourceLabels: Record<ApiKeySource, string> = {
  db: "Managed API Key",
  env: "Environment Variable",
  oauth: "OAuth (Claude Max/Pro)",
  unknown: "Unknown",
};

export function AuthStatusBadge({ connected, apiKeySource }: AuthStatusBadgeProps) {
  if (!connected && apiKeySource === "unknown") {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
        Not configured
      </Badge>
    );
  }

  if (!connected) {
    return (
      <Badge variant="outline" className="border-red-500/50 text-red-600 dark:text-red-400">
        Disconnected
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
      Connected via {sourceLabels[apiKeySource]}
    </Badge>
  );
}
