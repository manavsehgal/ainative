"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
  /** Hide this tab entirely */
  hidden?: boolean;
}

/**
 * Standard tab set for detail panes:
 *   Overview | Activity | Context | Policy | Cost | Raw
 *
 * Not every entity needs every tab — pass only the relevant ones.
 */
const STANDARD_TABS = [
  "overview",
  "activity",
  "context",
  "policy",
  "cost",
  "raw",
] as const;

interface DetailPaneTabsProps {
  tabs: DetailTab[];
  defaultTab?: string;
}

export function DetailPaneTabs({ tabs, defaultTab }: DetailPaneTabsProps) {
  const visibleTabs = tabs.filter((t) => !t.hidden);

  if (visibleTabs.length === 0) return null;

  const defaultValue = defaultTab ?? visibleTabs[0]?.id;

  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent px-4 h-9">
        {visibleTabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-accent"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {visibleTabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          className="p-4 mt-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** Helper: create standard tab definitions from a partial set */
export function buildStandardTabs(
  overrides: Partial<Record<(typeof STANDARD_TABS)[number], ReactNode>>
): DetailTab[] {
  return STANDARD_TABS.filter((id) => overrides[id] !== undefined).map(
    (id) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      content: overrides[id]!,
    })
  );
}
