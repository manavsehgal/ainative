"use client";

import { useEffect, useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { parseFilterInput } from "@/lib/filters/parse";

interface FilterHintProps {
  inputValue: string;
  storageKey: string;
  /** Optional copy override; defaults to the #key:value tip. */
  message?: string;
}

/**
 * FilterHint — passive discovery row for the `#key:value` filter syntax.
 *
 * Visibility rules:
 *  - Hidden once the dismissal flag is set in localStorage.
 *  - Hidden when the input contains `#` (user has discovered the syntax).
 *  - The flag is set the first time parseFilterInput returns ≥1 clause.
 *
 * Consumers: chat-command-popover, filter-input (list pages).
 */
export function FilterHint({ inputValue, storageKey, message }: FilterHintProps) {
  const [dismissed, setDismissed] = useState(false);

  const parsed = useMemo(() => parseFilterInput(inputValue), [inputValue]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        setDismissed(true);
      }
    } catch {
      // Private-mode or disabled storage — hint stays visible.
    }
  }, [storageKey]);

  useEffect(() => {
    if (dismissed) return;
    if (parsed.clauses.length > 0) {
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Private-mode or disabled storage — hint stays visible, no-op.
      }
      setDismissed(true);
    }
  }, [parsed.clauses.length, dismissed, storageKey]);

  if (dismissed) return null;
  if (inputValue.includes("#")) return null;

  return (
    <div
      role="note"
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground border-t border-border/50"
    >
      <Lightbulb className="h-3 w-3 shrink-0" aria-hidden />
      <span>
        {message ?? (
          <>
            Tip: use <code className="font-mono text-foreground">#key:value</code> to filter (e.g.{" "}
            <code className="font-mono text-foreground">#status:blocked</code>)
          </>
        )}
      </span>
    </div>
  );
}
