"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectDiffViewProps {
  artifactName: string;
  projectA: { name: string; preview: string | null };
  projectB: { name: string; preview: string | null };
}

/**
 * Side-by-side comparison of the same artifact across two projects.
 */
export function ProjectDiffView({
  artifactName,
  projectA,
  projectB,
}: ProjectDiffViewProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{artifactName}</h4>
      <div className="grid grid-cols-2 gap-4">
        <Card className="elevation-1">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground">
              {projectA.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {projectA.preview ? (
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-48">
                {projectA.preview}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">Not present</p>
            )}
          </CardContent>
        </Card>

        <Card className="elevation-1">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground">
              {projectB.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {projectB.preview ? (
              <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-48">
                {projectB.preview}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">Not present</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
