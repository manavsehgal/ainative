"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { COMMAND_TABS, type CommandTabId } from "@/lib/chat/command-tabs";

interface CommandTabBarProps {
  activeTab: CommandTabId;
  onChange: (tab: CommandTabId) => void;
  counts?: Partial<Record<CommandTabId, number>>;
}

export function CommandTabBar({ activeTab, onChange, counts }: CommandTabBarProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = COMMAND_TABS.findIndex((t) => t.id === activeTab);
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = COMMAND_TABS[(idx - 1 + COMMAND_TABS.length) % COMMAND_TABS.length];
        onChange(prev.id);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = COMMAND_TABS[(idx + 1) % COMMAND_TABS.length];
        onChange(next.id);
      }
    },
    [activeTab, onChange]
  );

  return (
    <div
      role="tablist"
      aria-label="Command categories"
      onKeyDown={handleKeyDown}
      className="flex items-center gap-1 border-b border-border px-2 pt-2"
    >
      {COMMAND_TABS.map((tab) => {
        const selected = tab.id === activeTab;
        const count = counts?.[tab.id];
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            aria-controls={`command-tabpanel-${tab.id}`}
            id={`command-tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {typeof count === "number" && count > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground/70">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
