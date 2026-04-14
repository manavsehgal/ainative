"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useCaretPosition } from "./use-caret-position";

export type AutocompleteMode = "slash" | "mention" | null;

export interface MentionReference {
  entityType: string;
  entityId: string;
  label: string;
}

export interface EntitySearchResult {
  entityType: string;
  entityId: string;
  label: string;
  status?: string;
  description?: string;
}

export interface AutocompleteState {
  open: boolean;
  mode: AutocompleteMode;
  query: string;
  triggerIndex: number;
  anchorRect: { top: number; left: number; height: number } | null;
}

export interface ChatAutocompleteReturn {
  state: AutocompleteState;
  entityResults: EntitySearchResult[];
  entityLoading: boolean;
  mentions: MentionReference[];
  handleChange: (value: string, textarea: HTMLTextAreaElement | null) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  handleSelect: (item: { type: "slash" | "mention"; id: string; label: string; text?: string }) => string;
  close: () => void;
  setTextareaRef: (el: HTMLTextAreaElement | null) => void;
}

const CLOSED_STATE: AutocompleteState = {
  open: false,
  mode: null,
  query: "",
  triggerIndex: -1,
  anchorRect: null,
};

/** Compact size label for file popover rows (e.g., "1.4 KB", "23 B"). */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detects "/" and "@" triggers in a textarea and manages autocomplete state.
 *
 * "/" triggers at position 0 or after a newline.
 * "@" triggers at position 0 or after whitespace.
 */
export function useChatAutocomplete(
  options: { projectId?: string | null } = {}
): ChatAutocompleteReturn {
  const [state, setState] = useState<AutocompleteState>(CLOSED_STATE);
  const [entityResults, setEntityResults] = useState<EntitySearchResult[]>([]);
  const [fileResults, setFileResults] = useState<EntitySearchResult[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [mentions, setMentions] = useState<MentionReference[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileAbortRef = useRef<AbortController | null>(null);
  const fileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entityCacheRef = useRef<EntitySearchResult[] | null>(null);
  const getCaretCoordinates = useCaretPosition();
  const projectIdRef = useRef(options.projectId ?? null);
  projectIdRef.current = options.projectId ?? null;

  // Ref to let the keyboard handler access current state synchronously
  const stateRef = useRef(state);
  stateRef.current = state;

  const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
  }, []);

  const close = useCallback(() => {
    setState(CLOSED_STATE);
    setEntityResults([]);
    setFileResults([]);
    setEntityLoading(false);
    entityCacheRef.current = null;
    if (abortRef.current) abortRef.current.abort();
    if (fileAbortRef.current) fileAbortRef.current.abort();
    if (fileDebounceRef.current) clearTimeout(fileDebounceRef.current);
  }, []);

  /**
   * Query the file search API with debounce + abort. Results are stored
   * in `fileResults` and merged into the popover stream alongside
   * entity results. Query is bound to the active "@" typeahead text.
   */
  const loadFiles = useCallback((query: string) => {
    // Debounce: wait 150ms after the last keystroke before firing.
    if (fileDebounceRef.current) clearTimeout(fileDebounceRef.current);
    fileDebounceRef.current = setTimeout(() => {
      if (fileAbortRef.current) fileAbortRef.current.abort();
      const controller = new AbortController();
      fileAbortRef.current = controller;

      const params = new URLSearchParams({ q: query, limit: "20" });
      const projectId = projectIdRef.current;
      if (projectId) params.set("projectId", projectId);

      fetch(`/api/chat/files/search?${params}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then(
          (data: {
            results?: Array<{ path: string; sizeBytes: number }>;
          }) => {
            const hits = data.results ?? [];
            const mapped: EntitySearchResult[] = hits.map((h) => ({
              entityType: "file",
              entityId: h.path,
              label: h.path,
              description: humanSize(h.sizeBytes),
            }));
            setFileResults(mapped);
          }
        )
        .catch(() => {
          // Aborted or failed — leave previous results in place.
        });
    }, 150);
  }, []);

  // Fetch all recent entities once on "@" trigger, cache for cmdk client-side filtering
  const loadEntities = useCallback(() => {
    if (entityCacheRef.current) {
      // Already cached — use cached results
      setEntityResults(entityCacheRef.current);
      return;
    }

    if (abortRef.current) abortRef.current.abort();

    setEntityLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    fetch("/api/chat/entities/search?q=&limit=20", { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const results = data.results ?? [];
          entityCacheRef.current = results;
          setEntityResults(results);
        }
      })
      .catch(() => {
        // Aborted or failed
      })
      .finally(() => {
        setEntityLoading(false);
      });
  }, []);

  // Detect triggers on every text change
  const handleChange = useCallback(
    (value: string, textarea: HTMLTextAreaElement | null) => {
      if (!textarea) {
        close();
        return;
      }

      const cursorPos = textarea.selectionStart;
      if (cursorPos == null) {
        close();
        return;
      }

      // Look backward from cursor for a trigger character
      const textBeforeCursor = value.substring(0, cursorPos);

      // Check for "/" trigger — at position 0 or after whitespace (works mid-prompt)
      const slashMatch = textBeforeCursor.match(/(?:^|\s)(\/[^\s]*)$/);
      if (slashMatch) {
        const triggerIndex = cursorPos - slashMatch[1].length;
        const query = slashMatch[1].substring(1); // text after "/"
        const coords = getCaretCoordinates(textarea, triggerIndex);
        setState({
          open: true,
          mode: "slash",
          query,
          triggerIndex,
          anchorRect: coords,
        });
        return;
      }

      // Check for "@" trigger — must be at position 0 or after whitespace
      const mentionMatch = textBeforeCursor.match(/(?:^|\s)(@[^\s]*)$/);
      if (mentionMatch) {
        const triggerIndex = cursorPos - mentionMatch[1].length;
        const query = mentionMatch[1].substring(1); // text after "@"
        const coords = getCaretCoordinates(textarea, triggerIndex);
        setState({
          open: true,
          mode: "mention",
          query,
          triggerIndex,
          anchorRect: coords,
        });
        loadEntities();
        // File search fires only when the user has typed something after `@`
        // — an empty query would return every tracked file in the repo, which
        // is noisy and defeats the whole "type to narrow" interaction.
        if (query.length > 0) {
          loadFiles(query);
        } else {
          setFileResults([]);
        }
        return;
      }

      // No trigger found — close
      if (stateRef.current.open) {
        close();
      }
    },
    [getCaretCoordinates, loadEntities, loadFiles, close]
  );

  /**
   * Intercepts keyboard events when the popover is open.
   * Returns true if the event was consumed (caller should skip default handling).
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!stateRef.current.open) return false;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          return true;

        case "ArrowUp":
        case "ArrowDown":
          // Let cmdk handle navigation — we just prevent textarea cursor movement
          e.preventDefault();
          // Dispatch a synthetic keyboard event on the hidden cmdk input
          const cmdkInput = document.querySelector(
            "[data-chat-autocomplete] [cmdk-input]"
          ) as HTMLInputElement | null;
          if (cmdkInput) {
            cmdkInput.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: e.key,
                bubbles: true,
                cancelable: true,
              })
            );
          }
          return true;

        case "Enter":
        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            // Trigger selection of currently highlighted cmdk item
            const selected = document.querySelector(
              "[data-chat-autocomplete] [cmdk-item][data-selected=true]"
            ) as HTMLElement | null;
            if (selected) {
              selected.click();
            } else {
              close();
            }
            return true;
          }
          return false;

        default:
          return false;
      }
    },
    [close]
  );

  /**
   * Called when an item is selected from the popover.
   * Returns the new textarea value with the trigger+query replaced.
   */
  const handleSelect = useCallback(
    (item: { type: "slash" | "mention"; id: string; label: string; text?: string; entityType?: string; entityId?: string }): string => {
      const textarea = textareaRef.current;
      if (!textarea) {
        close();
        return "";
      }

      const currentValue = textarea.value;
      const { triggerIndex } = stateRef.current;
      const cursorPos = textarea.selectionStart;

      let replacement: string;
      if (item.type === "slash") {
        replacement = item.text ?? item.label;
      } else {
        // "@" mention — format depends on entity type:
        //   file:  @<path>           (CLI-style, matches what users type)
        //   other: @<type>:<label>   (disambiguates entity types)
        const eType = item.entityType ?? item.id;
        const eId = item.entityId ?? item.id;
        replacement =
          eType === "file"
            ? `@${item.label} `
            : `@${eType}:${item.label} `;
        // Track the mention
        setMentions((prev) => {
          if (prev.some((m) => m.entityId === eId)) return prev;
          return [...prev, { entityType: eType, entityId: eId, label: item.label }];
        });
      }

      const newValue =
        currentValue.substring(0, triggerIndex) +
        replacement +
        currentValue.substring(cursorPos);

      close();
      return newValue;
    },
    [close]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (fileAbortRef.current) fileAbortRef.current.abort();
      if (fileDebounceRef.current) clearTimeout(fileDebounceRef.current);
    };
  }, []);

  return {
    state,
    // Merge entity results with file results so the popover's single
    // group-by-entityType render path covers both — no second props
    // channel needed.
    entityResults: [...entityResults, ...fileResults],
    entityLoading,
    mentions,
    handleChange,
    handleKeyDown,
    handleSelect,
    close,
    setTextareaRef,
  };
}
