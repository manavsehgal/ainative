/**
 * Shortcut Registry — singleton that manages keyboard shortcut bindings.
 *
 * Supports:
 * - Global shortcuts (always active)
 * - Surface-level shortcuts (active when a specific surface is mounted)
 * - Modifier keys: Meta (⌘), Ctrl, Alt, Shift
 * - Sequence keys: "g d" (press g then d within 500ms)
 */

export type ShortcutScope = "global" | string;

export interface ShortcutEntry {
  /** Unique ID for this shortcut */
  id: string;
  /** Human-readable key combo (e.g., "⌘ K", "g d", "j") */
  keys: string;
  /** Description shown in cheat sheet */
  description: string;
  /** Scope: "global" or a surface name */
  scope: ShortcutScope;
  /** Category for cheat sheet grouping */
  category: string;
  /** Handler function */
  handler: () => void;
}

class ShortcutRegistryImpl {
  private shortcuts = new Map<string, ShortcutEntry>();
  private sequenceBuffer = "";
  private sequenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private cachedSnapshot: ShortcutEntry[] = [];

  register(entry: ShortcutEntry) {
    this.shortcuts.set(entry.id, entry);
    this.updateSnapshot();
    this.notifyListeners();
    return () => {
      this.shortcuts.delete(entry.id);
      this.updateSnapshot();
      this.notifyListeners();
    };
  }

  unregister(id: string) {
    this.shortcuts.delete(id);
    this.updateSnapshot();
    this.notifyListeners();
  }

  private updateSnapshot() {
    this.cachedSnapshot = Array.from(this.shortcuts.values());
  }

  getAll(): ShortcutEntry[] {
    return this.cachedSnapshot;
  }

  getByScope(scope: ShortcutScope): ShortcutEntry[] {
    return this.getAll().filter((s) => s.scope === scope);
  }

  getByCategory(): Map<string, ShortcutEntry[]> {
    const map = new Map<string, ShortcutEntry[]>();
    for (const entry of this.shortcuts.values()) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }

  /**
   * Handle a keyboard event. Returns true if a shortcut was matched.
   */
  handleKeyDown(event: KeyboardEvent, activeScope?: string): boolean {
    // Skip when user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable
    ) {
      // Allow Meta+key combos even in inputs
      if (!event.metaKey && !event.ctrlKey) return false;
    }

    // Build key string
    const parts: string[] = [];
    if (event.metaKey) parts.push("meta");
    if (event.ctrlKey) parts.push("ctrl");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey) parts.push("shift");
    parts.push(event.key.toLowerCase());
    const keyCombo = parts.join("+");

    // Check for sequence shortcuts (e.g., "g d")
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      if (this.sequenceTimeout) {
        clearTimeout(this.sequenceTimeout);
        this.sequenceTimeout = null;
      }

      const newBuffer = this.sequenceBuffer
        ? `${this.sequenceBuffer} ${event.key.toLowerCase()}`
        : event.key.toLowerCase();

      // Try to match the sequence
      for (const entry of this.shortcuts.values()) {
        if (entry.scope !== "global" && entry.scope !== activeScope) continue;
        const normalizedKeys = entry.keys.toLowerCase().replace(/\s+/g, " ");
        if (normalizedKeys === newBuffer) {
          event.preventDefault();
          entry.handler();
          this.sequenceBuffer = "";
          return true;
        }
      }

      // Check if any shortcut starts with this sequence
      const hasPartialMatch = Array.from(this.shortcuts.values()).some(
        (entry) => {
          const normalizedKeys = entry.keys.toLowerCase().replace(/\s+/g, " ");
          return normalizedKeys.startsWith(newBuffer + " ");
        }
      );

      if (hasPartialMatch) {
        this.sequenceBuffer = newBuffer;
        this.sequenceTimeout = setTimeout(() => {
          this.sequenceBuffer = "";
        }, 500);
        return false;
      }

      this.sequenceBuffer = event.key.toLowerCase();
      this.sequenceTimeout = setTimeout(() => {
        this.sequenceBuffer = "";
      }, 500);
    }

    // Check for modifier combos
    const keyMap: Record<string, string> = {
      "⌘ k": "meta+k",
      "⌘ /": "meta+/",
      "⌘ .": "meta+.",
      "⌘ b": "meta+b",
    };

    for (const entry of this.shortcuts.values()) {
      if (entry.scope !== "global" && entry.scope !== activeScope) continue;
      const mapped = keyMap[entry.keys.toLowerCase()] ?? entry.keys.toLowerCase();
      if (mapped === keyCombo) {
        event.preventDefault();
        entry.handler();
        return true;
      }
    }

    return false;
  }
}

// Singleton instance
export const shortcutRegistry = new ShortcutRegistryImpl();
