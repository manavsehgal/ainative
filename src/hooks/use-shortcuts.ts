"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  shortcutRegistry,
  type ShortcutEntry,
  type ShortcutScope,
} from "@/lib/keyboard/shortcut-registry";

/**
 * Register shortcuts that are active while this component is mounted.
 *
 * Usage:
 *   useShortcuts([
 *     { id: "nav-home", keys: "g h", description: "Go to Home", scope: "global", category: "Navigation", handler: () => router.push("/") },
 *   ]);
 */
export function useShortcuts(entries: ShortcutEntry[]) {
  useEffect(() => {
    const cleanups = entries.map((entry) => shortcutRegistry.register(entry));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [entries]);
}

/**
 * Subscribe to registry changes for rendering (e.g., cheat sheet).
 */
const EMPTY_SHORTCUTS: ShortcutEntry[] = [];

export function useShortcutList(): ShortcutEntry[] {
  return useSyncExternalStore(
    (cb) => shortcutRegistry.subscribe(cb),
    () => shortcutRegistry.getAll(),
    () => EMPTY_SHORTCUTS
  );
}

/**
 * Hook to attach the global keyboard listener.
 * Mount once in a layout-level component.
 */
export function useGlobalKeyboardListener(activeScope?: ShortcutScope) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      shortcutRegistry.handleKeyDown(event, activeScope);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeScope]);
}
