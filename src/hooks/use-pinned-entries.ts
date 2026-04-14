"use client";

/**
 * `usePinnedEntries` — client-side store for chat mention-popover pins.
 *
 * Fetches once on mount, keeps an in-memory list in React state, and writes
 * back via PUT on every mutation (full-list replacement — see
 * `src/app/api/settings/chat/pins/route.ts` for design rationale).
 *
 * Exposes:
 *  - `pins`: current pinned entries (stable identity per mount)
 *  - `isPinned(id)`: fast membership check
 *  - `pin(entry)` / `unpin(id)`: optimistic mutations with background sync
 *  - `loading`: true while the initial GET is in flight
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export interface PinnedEntry {
  id: string;
  type: string;
  label: string;
  description?: string;
  status?: string;
  pinnedAt: string;
}

interface UsePinnedEntriesReturn {
  pins: PinnedEntry[];
  loading: boolean;
  isPinned: (id: string) => boolean;
  pin: (entry: Omit<PinnedEntry, "pinnedAt">) => void;
  unpin: (id: string) => void;
}

export function usePinnedEntries(): UsePinnedEntriesReturn {
  const [pins, setPins] = useState<PinnedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/chat/pins")
      .then((r) => (r.ok ? r.json() : { pins: [] }))
      .then((data: { pins?: PinnedEntry[] }) => {
        if (!cancelled) setPins(data.pins ?? []);
      })
      .catch(() => {
        // Network / parse failure: start with empty list. Subsequent writes
        // will create the setting on first mutation.
        if (!cancelled) setPins([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pinnedIdSet = useMemo(() => new Set(pins.map((p) => p.id)), [pins]);

  const isPinned = useCallback(
    (id: string) => pinnedIdSet.has(id),
    [pinnedIdSet]
  );

  const persist = useCallback(async (next: PinnedEntry[]) => {
    try {
      await fetch("/api/settings/chat/pins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pins: next }),
      });
    } catch {
      // Optimistic update already applied; server sync failure is silently
      // swallowed. A future follow-up can add a toast on persistent failure.
    }
  }, []);

  const pin = useCallback(
    (entry: Omit<PinnedEntry, "pinnedAt">) => {
      if (pinnedIdSet.has(entry.id)) return;
      const next: PinnedEntry[] = [
        ...pins,
        { ...entry, pinnedAt: new Date().toISOString() },
      ];
      setPins(next);
      void persist(next);
    },
    [pins, pinnedIdSet, persist]
  );

  const unpin = useCallback(
    (id: string) => {
      if (!pinnedIdSet.has(id)) return;
      const next = pins.filter((p) => p.id !== id);
      setPins(next);
      void persist(next);
    },
    [pins, pinnedIdSet, persist]
  );

  return { pins, loading, isPinned, pin, unpin };
}
