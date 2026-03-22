"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnvironmentArtifactRow } from "@/lib/db/schema";
import { PersonaIndicator } from "./persona-indicator";

interface ToolComparisonViewProps {
  artifacts: EnvironmentArtifactRow[];
}

/**
 * Side-by-side comparison of Claude Code vs Codex artifacts.
 * Groups shared artifacts in the center.
 * Stretch goal — basic implementation for now.
 */
export function ToolComparisonView({ artifacts }: ToolComparisonViewProps) {
  const claude = artifacts.filter((a) => a.tool === "claude-code");
  const codex = artifacts.filter((a) => a.tool === "codex");
  const shared = artifacts.filter((a) => a.tool === "shared");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="elevation-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PersonaIndicator tool="claude-code" size="md" />
            <span>{claude.length} artifacts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {claude.map((a) => (
            <div key={a.id} className="text-xs truncate text-muted-foreground">
              {a.name}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="elevation-1 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PersonaIndicator tool="shared" size="md" />
            <span>{shared.length} shared</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {shared.map((a) => (
            <div key={a.id} className="text-xs truncate text-muted-foreground">
              {a.name}
            </div>
          ))}
          {shared.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No shared artifacts</p>
          )}
        </CardContent>
      </Card>

      <Card className="elevation-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PersonaIndicator tool="codex" size="md" />
            <span>{codex.length} artifacts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {codex.map((a) => (
            <div key={a.id} className="text-xs truncate text-muted-foreground">
              {a.name}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
