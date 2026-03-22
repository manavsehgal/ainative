"use client";

import { RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnvironmentScanRow } from "@/lib/db/schema";

interface ScanStatusBarProps {
  scan: EnvironmentScanRow;
  scanning: boolean;
  onScan: () => void;
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ScanStatusBar({ scan, scanning, onScan }: ScanStatusBarProps) {
  const personas = (() => {
    try {
      return JSON.parse(scan.persona) as string[];
    } catch {
      return [scan.persona];
    }
  })();

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {scan.artifactCount} artifacts
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Scanned {formatRelativeTime(scan.scannedAt)}
        </span>
        {scan.durationMs != null && (
          <span className="text-xs">({scan.durationMs}ms)</span>
        )}
        <span className="text-xs">
          {personas.map((p) => p === "claude-code" ? "Claude Code" : p === "codex" ? "Codex" : p).join(" + ")}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onScan} disabled={scanning}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${scanning ? "animate-spin" : ""}`} />
        {scanning ? "Scanning..." : "Scan Now"}
      </Button>
    </div>
  );
}
