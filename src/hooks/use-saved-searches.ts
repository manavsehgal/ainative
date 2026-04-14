"use client";

/**
 * `useSavedSearches` — client-side store for saved filter combinations
 * surfaced in the chat mention popover and `⌘K` palette.
 *
 * Mirrors `use-pinned-entries.ts`: fetches once on mount, keeps an
 * in-memory list, and writes back via PUT on every mutation (full-list
 * replacement — see `src/app/api/settings/chat/saved-searches/route.ts`
 * for design rationale).
 */

import { useCallback, useEffect, useState } from "react";

export type SavedSearchSurface =
  | "task"
  | "project"
  | "workflow"
  | "document"
  | "skill"
  | "profile";

export interface SavedSearch {
  id: string;
  surface: SavedSearchSurface;
  label: string;
  filterInput: string;
  createdAt: string;
}

interface UseSavedSearchesReturn {
  searches: SavedSearch[];
  loading: boolean;
  save: (entry: Omit<SavedSearch, "id" | "createdAt">) => SavedSearch;
  remove: (id: string) => void;
  forSurface: (surface: SavedSearchSurface) => SavedSearch[];
}

export function useSavedSearches(): UseSavedSearchesReturn {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/chat/saved-searches")
      .then((r) => (r.ok ? r.json() : { searches: [] }))
      .then((data: { searches?: SavedSearch[] }) => {
        if (!cancelled) setSearches(data.searches ?? []);
      })
      .catch(() => {
        if (!cancelled) setSearches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: SavedSearch[]) => {
    try {
      await fetch("/api/settings/chat/saved-searches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searches: next }),
      });
    } catch {
      // Optimistic update already applied; server-sync failure silently
      // swallowed. Matches the pins-hook contract.
    }
  }, []);

  const save = useCallback(
    (entry: Omit<SavedSearch, "id" | "createdAt">): SavedSearch => {
      const full: SavedSearch = {
        ...entry,
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };
      setSearches((prev) => {
        const next = [...prev, full];
        void persist(next);
        return next;
      });
      return full;
    },
    [persist]
  );

  const remove = useCallback(
    (id: string) => {
      setSearches((prev) => {
        const next = prev.filter((s) => s.id !== id);
        void persist(next);
        return next;
      });
    },
    [persist]
  );

  const forSurface = useCallback(
    (surface: SavedSearchSurface) =>
      searches.filter((s) => s.surface === surface),
    [searches]
  );

  return { searches, loading, save, remove, forSurface };
}
