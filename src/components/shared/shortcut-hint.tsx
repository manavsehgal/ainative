import { cn } from "@/lib/utils";

interface ShortcutHintProps {
  /** Key combo to display (e.g., "⌘ K", "g d") */
  keys: string;
  className?: string;
}

/**
 * Inline keyboard shortcut hint — renders as styled <kbd> badges.
 */
export function ShortcutHint({ keys, className }: ShortcutHintProps) {
  const parts = keys.split(/\s+/);

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
