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
      <Badge variant="outline" className="border-warning/50 text-warning">
        Not configured
      </Badge>
    );
  }

  if (!connected) {
    return (
      <Badge variant="outline" className="border-status-failed/50 text-status-failed">
        Disconnected
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-success/50 text-success">
      Connected via {sourceLabels[apiKeySource]}
    </Badge>
  );
}
