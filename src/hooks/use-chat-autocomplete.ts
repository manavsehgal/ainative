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

/**
 * Detects "/" and "@" triggers in a textarea and manages autocomplete state.
 *
 * "/" triggers at position 0 or after a newline.
 * "@" triggers at position 0 or after whitespace.
 */
export function useChatAutocomplete(): ChatAutocompleteReturn {
  const [state, setState] = useState<AutocompleteState>(CLOSED_STATE);
  const [entityResults, setEntityResults] = useState<EntitySearchResult[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [mentions, setMentions] = useState<MentionReference[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const getCaretCoordinates = useCaretPosition();

  // Ref to let the keyboard handler access current state synchronously
  const stateRef = useRef(state);
  stateRef.current = state;

  const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
  }, []);

  const close = useCallback(() => {
    setState(CLOSED_STATE);
    setEntityResults([]);
    setEntityLoading(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  // Debounced entity search for "@" mode
  const searchEntities = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!query.trim()) {
      setEntityResults([]);
      setEntityLoading(false);
      return;
    }

    setEntityLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/chat/entities/search?q=${encodeURIComponent(query)}&limit=10`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setEntityResults(data.results ?? []);
        }
      } catch {
        // Aborted or failed
      } finally {
        setEntityLoading(false);
      }
    }, 200);
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

      // Check for "/" trigger — must be at position 0 or after newline
      const slashMatch = textBeforeCursor.match(/(?:^|\n)(\/[^\n]*)$/);
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
        searchEntities(query);
        return;
      }

      // No trigger found — close
      if (stateRef.current.open) {
        close();
      }
    },
    [getCaretCoordinates, searchEntities, close]
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
        // "@" mention — insert @type:Name
        const eType = item.entityType ?? item.id;
        const eId = item.entityId ?? item.id;
        replacement = `@${eType}:${item.label} `;
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    state,
    entityResults,
    entityLoading,
    mentions,
    handleChange,
    handleKeyDown,
    handleSelect,
    close,
    setTextareaRef,
  };
}
