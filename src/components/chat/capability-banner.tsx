"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getRuntimeFeatures, type AgentRuntimeId } from "@/lib/agents/runtime/catalog";
import { cn } from "@/lib/utils";

interface CapabilityBannerProps {
  runtimeId: AgentRuntimeId;
  className?: string;
}

function dismissKey(runtimeId: string): string {
  return `ainative.capability-banner.dismissed.${runtimeId}`;
}

function readDismissed(runtimeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(dismissKey(runtimeId)) === "1";
  } catch {
    return false;
  }
}

export function CapabilityBanner({ runtimeId, className }: CapabilityBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(runtimeId));

  useEffect(() => {
    setDismissed(readDismissed(runtimeId));
  }, [runtimeId]);

  const features = getRuntimeFeatures(runtimeId);
  const limited = !features.hasFilesystemTools && !features.hasBash;

  if (!limited || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(dismissKey(runtimeId), "1");
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 px-4 py-1.5 text-xs text-muted-foreground animate-in fade-in-0",
        className
      )}
    >
      <span className="flex-1">
        Features like file read/write, Bash, and hooks are not available on this runtime. Switch models to use them.
      </span>
      <button
        type="button"
        aria-label="Dismiss capability notice"
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
