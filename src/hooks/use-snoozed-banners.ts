"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "stagent-snoozed-banners";
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SnoozedEntry {
  until: number; // Unix timestamp
}

function loadSnoozed(): Record<string, SnoozedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SnoozedEntry>;
    // Prune expired entries
    const now = Date.now();
    const active: Record<string, SnoozedEntry> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry.until > now) active[key] = entry;
    }
    return active;
  } catch {
    return {};
  }
}

function saveSnoozed(data: Record<string, SnoozedEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Hook for managing snoozed upgrade banners.
 * Banners can be snoozed for 7 days using localStorage.
 */
export function useSnoozedBanners() {
  const [snoozed, setSnoozed] = useState<Record<string, SnoozedEntry>>(loadSnoozed);

  const isSnoozed = useCallback(
    (bannerId: string): boolean => {
      const entry = snoozed[bannerId];
      if (!entry) return false;
      return entry.until > Date.now();
    },
    [snoozed]
  );

  const snooze = useCallback((bannerId: string) => {
    const updated = {
      ...loadSnoozed(),
      [bannerId]: { until: Date.now() + SNOOZE_DURATION_MS },
    };
    saveSnoozed(updated);
    setSnoozed(updated);
  }, []);

  const dismiss = useCallback((bannerId: string) => {
    // Dismiss = snooze for a very long time (effectively permanent)
    const updated = {
      ...loadSnoozed(),
      [bannerId]: { until: Date.now() + 365 * 24 * 60 * 60 * 1000 },
    };
    saveSnoozed(updated);
    setSnoozed(updated);
  }, []);

  return { isSnoozed, snooze, dismiss };
}
