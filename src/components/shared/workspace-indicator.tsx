"use client";

import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";

interface WorkspaceData {
  folderName: string;
  parentPath: string;
  gitBranch: string | null;
  isWorktree: boolean;
}

interface WorkspaceIndicatorProps {
  variant: "sidebar" | "inline";
}

export function WorkspaceIndicator({ variant }: WorkspaceIndicatorProps) {
  const [data, setData] = useState<WorkspaceData | null>(null);

  useEffect(() => {
    fetch("/api/workspace/context")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  if (variant === "inline") {
    return (
      <span className="text-sm text-muted-foreground">
        {data.parentPath}/
        <span className="font-medium text-foreground">{data.folderName}</span>
        {data.gitBranch && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground/70">
            <GitBranch className="h-3 w-3" />
            {data.gitBranch}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted-foreground truncate">
        {data.parentPath}/<span className="font-semibold text-foreground">{data.folderName}</span>
      </p>
      {data.gitBranch && (
        <p className="text-[11px] text-muted-foreground/70 truncate flex items-center gap-1 mt-0.5">
          <GitBranch className="h-3 w-3 shrink-0" />
          {data.gitBranch}
          {data.isWorktree && (
            <span className="text-[10px] bg-muted px-1 rounded">worktree</span>
          )}
        </p>
      )}
    </div>
  );
}
