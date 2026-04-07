"use client";

import { useEffect, useState } from "react";
import type { UpgradeState } from "@/lib/instance/types";

/**
 * Small info chip rendered in the sidebar when upstream has new commits.
 *
 * Deliberately tertiary in the visual hierarchy — it's ambient awareness,
 * not a call to action. Fetches status on mount and every 5 minutes while
 * mounted (lightweight — the endpoint is a single settings read).
 *
 * Placement: above the Settings nav item in the Configure group.
 */
export function UpgradeBadge() {
  const [state, setState] = useState<UpgradeState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/instance/upgrade/status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as UpgradeState;
        if (!cancelled) setState(data);
      } catch {
        // Silent — the badge is ambient; status fetch failures should not
        // produce UI noise. Persistent poll failures surface as notifications
        // from the upgrade poller itself.
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!state || !state.upgradeAvailable) return null;

  const failing = state.pollFailureCount >= 3;
  const label = failing
    ? "Check failing"
    : `${state.commitsBehind} commit${state.commitsBehind === 1 ? "" : "s"}`;
  const tooltip = failing
    ? "Upgrade check failing — click to retry"
    : `${state.commitsBehind} upstream commit${state.commitsBehind === 1 ? "" : "s"} ready to merge`;

  return (
    <span
      role="status"
      aria-label={tooltip}
      title={tooltip}
      className={
        failing
          ? "ml-2 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
          : "ml-2 inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400"
      }
    >
      {label}
    </span>
  );
}
