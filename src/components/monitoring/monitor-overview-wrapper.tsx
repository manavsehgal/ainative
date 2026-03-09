"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const AUTO_REFRESH_INTERVAL = 15_000; // 15 seconds

export function MonitorRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  // Pause auto-refresh when tab is not visible
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    function onVisibilityChange() {
      setVisible(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (autoRefresh && visible) {
      intervalRef.current = setInterval(handleRefresh, AUTO_REFRESH_INTERVAL);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [autoRefresh, visible, handleRefresh]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={autoRefresh ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setAutoRefresh((prev) => !prev)}
        aria-label={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}
      >
        {autoRefresh ? "Auto" : "Manual"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={isPending}
        aria-label="Refresh metrics"
      >
        <RefreshCw className={`h-4 w-4 ${isPending || autoRefresh ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
