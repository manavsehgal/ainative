"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FolderKanban,
  ListTodo,
  GitBranch,
  FileText,
  FileCode,
  Bot,
  Clock,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  getToolCatalogWithSkills,
  groupToolCatalog,
  TOOL_GROUP_ICONS,
} from "@/lib/chat/tool-catalog";
import type { AutocompleteMode, EntitySearchResult } from "@/hooks/use-chat-autocomplete";
import { CommandTabBar } from "./command-tab-bar";
import { partitionCatalogByTab, type CommandTabId } from "@/lib/chat/command-tabs";
import { useEnrichedSkills } from "@/hooks/use-enriched-skills";
import { useRecentUserMessages } from "@/hooks/use-recent-user-messages";
import { SkillRow } from "./skill-row";
import { computeRecommendation } from "@/lib/environment/skill-recommendations";
import { browserLocalStore, activeDismissedIds } from "@/lib/chat/dismissals";
import { useChatSession } from "@/components/chat/chat-session-provider";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";

interface ChatCommandPopoverProps {
  open: boolean;
  mode: AutocompleteMode;
  query: string;
  anchorRect: { top: number; left: number; height: number } | null;
  entityResults: EntitySearchResult[];
  entityLoading: boolean;
  projectProfiles?: Array<{ id: string; name: string; description: string }>;
  activeTab: CommandTabId;
  onTabChange: (tab: CommandTabId) => void;
  onSelect: (item: {
    type: "slash" | "mention";
    id: string;
    label: string;
    text?: string;
    entityType?: string;
    entityId?: string;
  }) => void;
  onClose: () => void;
}

const ENTITY_ICONS: Record<string, LucideIcon> = {
  project: FolderKanban,
  task: ListTodo,
  workflow: GitBranch,
  document: FileText,
  profile: Bot,
  schedule: Clock,
  file: FileCode,
};

const ENTITY_LABELS: Record<string, string> = {
  project: "Projects",
  task: "Tasks",
  workflow: "Workflows",
  document: "Documents",
  profile: "Profiles",
  schedule: "Schedules",
  file: "Files",
};

function groupByType(results: EntitySearchResult[]): Record<string, EntitySearchResult[]> {
  const groups: Record<string, EntitySearchResult[]> = {};
  for (const r of results) {
    if (!groups[r.entityType]) groups[r.entityType] = [];
    groups[r.entityType].push(r);
  }
  return groups;
}

export function ChatCommandPopover({
  open,
  mode,
  query,
  anchorRect,
  entityResults,
  entityLoading,
  projectProfiles,
  activeTab,
  onTabChange,
  onSelect,
  onClose,
}: ChatCommandPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  // Enriched skills — only fetch when popover is open in slash mode
  const enrichedSkills = useEnrichedSkills(open && mode === "slash");

  // Session context for recommendation
  const { activeId } = useChatSession();
  const recentMessages = useRecentUserMessages(activeId, 20);

  const dismissStore = useMemo(
    () => browserLocalStore("stagent.chat.dismissed-suggestions"),
    []
  );
  const dismissedIds = useMemo(
    () =>
      activeId
        ? activeDismissedIds(dismissStore, activeId)
        : new Set<string>(),
    [dismissStore, activeId]
  );

  const recommended = useMemo(
    () =>
      computeRecommendation(enrichedSkills, recentMessages, {
        dismissedIds,
      }),
    [enrichedSkills, recentMessages, dismissedIds]
  );

  if (!open || !anchorRect || !mode) return null;

  // Position above the caret
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, anchorRect.left),
    bottom: window.innerHeight - anchorRect.top + 4,
    zIndex: 50,
    width: 360,
  };

  const content = (
    <div
      ref={containerRef}
      style={style}
      data-chat-autocomplete=""
      className="rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0"
    >
      <Command shouldFilter loop>
        {/* Hidden input for cmdk filtering — synced to query */}
        <div className="sr-only">
          <CommandInput value={query} />
        </div>

        {mode === "slash" ? (
          <>
            <CommandTabBar activeTab={activeTab} onChange={onTabChange} />
            <CommandList className="max-h-[320px]">
              {activeTab !== "entities" && (
                <CommandEmpty>No matching tools</CommandEmpty>
              )}
              <div
                role="tabpanel"
                id={`command-tabpanel-${activeTab}`}
                aria-labelledby={`command-tab-${activeTab}`}
              >
                <ToolCatalogItems
                  onSelect={onSelect}
                  projectProfiles={projectProfiles}
                  activeTab={activeTab}
                  enrichedSkills={enrichedSkills}
                  recommendedId={recommended?.id ?? null}
                />
              </div>
            </CommandList>
          </>
        ) : (
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No matching entities</CommandEmpty>
            <MentionItems
              results={entityResults}
              loading={entityLoading}
              onSelect={onSelect}
            />
          </CommandList>
        )}
      </Command>
    </div>
  );

  return createPortal(content, document.body);
}

function ToolCatalogItems({
  onSelect,
  projectProfiles,
  activeTab,
  enrichedSkills,
  recommendedId,
}: {
  onSelect: ChatCommandPopoverProps["onSelect"];
  projectProfiles?: ChatCommandPopoverProps["projectProfiles"];
  activeTab: CommandTabId;
  enrichedSkills: EnrichedSkill[];
  recommendedId?: string | null;
}) {
  const catalog = getToolCatalogWithSkills({
    includeBrowser: true,
    projectProfiles,
  });
  const parts = partitionCatalogByTab(catalog);
  const entries = parts[activeTab];

  if (activeTab === "entities") {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground text-center">
        Type <span className="font-mono text-foreground">@</span> to reference projects, tasks, documents, or files.
      </div>
    );
  }

  // When the skills tab has enriched data, render the enriched list
  if (activeTab === "skills" && enrichedSkills.length > 0) {
    return (
      <CommandGroup heading="Skills">
        {enrichedSkills.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            recommended={recommendedId === skill.id}
            onSelect={() =>
              onSelect({
                type: "slash",
                id: skill.name,
                label: skill.name,
                text: `Use the ${skill.name} profile: `,
              })
            }
          />
        ))}
      </CommandGroup>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground text-center">
        {activeTab === "skills" ? "No skills available yet." : "Nothing here."}
      </div>
    );
  }

  const groups = groupToolCatalog(entries);
  const groupNames = Object.keys(groups);

  return (
    <>
      {groupNames.map((groupName) => {
        const items = groups[groupName];
        if (!items?.length) return null;
        const GroupIcon = TOOL_GROUP_ICONS[groupName as keyof typeof TOOL_GROUP_ICONS] ?? FileText;
        return (
          <CommandGroup key={groupName} heading={groupName}>
            {items.map((entry) => (
              <CommandItem
                key={entry.name}
                value={`${entry.name} ${entry.description} ${entry.group}`}
                onSelect={() =>
                  onSelect({
                    type: "slash",
                    id: entry.name,
                    label: entry.name,
                    text: entry.behavior === "execute_immediately"
                      ? entry.name
                      : entry.group === "Skills"
                          ? `Use the ${entry.name} profile: `
                          : `Use ${entry.name} to `,
                  })
                }
              >
                <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium">{entry.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                </div>
                {entry.paramHint && (
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60 font-mono">
                    {entry.paramHint}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
    </>
  );
}

function MentionItems({
  results,
  loading,
  onSelect,
}: {
  results: EntitySearchResult[];
  loading: boolean;
  onSelect: ChatCommandPopoverProps["onSelect"];
}) {
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  const grouped = groupByType(results);
  const entityTypes = Object.keys(grouped);

  if (entityTypes.length === 0) {
    return null; // CommandEmpty will show
  }

  return (
    <>
      {entityTypes.map((type) => {
        const Icon = ENTITY_ICONS[type] ?? FileText;
        const groupLabel = ENTITY_LABELS[type] ?? type;
        const isFile = type === "file";
        return (
          <CommandGroup key={type} heading={groupLabel}>
            {grouped[type].map((entity) => (
              <CommandItem
                key={`${entity.entityType}-${entity.entityId}`}
                value={`${entity.entityType} ${entity.label} ${entity.description ?? ""} ${entity.status ?? ""}`}
                onSelect={() =>
                  onSelect({
                    type: "mention",
                    id: entity.entityType,
                    label: entity.label,
                    entityType: entity.entityType,
                    entityId: entity.entityId,
                  })
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span
                    className={
                      isFile
                        ? "flex-1 truncate font-mono text-xs"
                        : "flex-1 truncate"
                    }
                  >
                    {entity.label}
                  </span>
                  {entity.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {entity.description}
                    </span>
                  )}
                </div>
                {entity.status && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {entity.status}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
    </>
  );
}
