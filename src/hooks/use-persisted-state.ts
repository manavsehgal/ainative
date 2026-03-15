"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useState wrapper that persists to localStorage.
 * Reads from storage in useEffect to avoid SSR hydration mismatch.
 */
export function usePersistedState<T extends string>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // Restore from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(stored as T);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing)
    }
  }, [key]);

  const setPersisted = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // localStorage unavailable
      }
    },
    [key]
  );

  return [value, setPersisted];
}
