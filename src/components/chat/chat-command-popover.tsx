"use client";

import { useEffect, useRef } from "react";
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
  Bot,
  Clock,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSlashCommands, type SlashCommand } from "@/lib/chat/slash-commands";
import type { AutocompleteMode, EntitySearchResult } from "@/hooks/use-chat-autocomplete";

interface ChatCommandPopoverProps {
  open: boolean;
  mode: AutocompleteMode;
  query: string;
  anchorRect: { top: number; left: number; height: number } | null;
  entityResults: EntitySearchResult[];
  entityLoading: boolean;
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
};

const ENTITY_LABELS: Record<string, string> = {
  project: "Projects",
  task: "Tasks",
  workflow: "Workflows",
  document: "Documents",
  profile: "Profiles",
  schedule: "Schedules",
};

function groupByType(results: EntitySearchResult[]): Record<string, EntitySearchResult[]> {
  const groups: Record<string, EntitySearchResult[]> = {};
  for (const r of results) {
    if (!groups[r.entityType]) groups[r.entityType] = [];
    groups[r.entityType].push(r);
  }
  return groups;
}

function groupSlashCommands(commands: SlashCommand[]): Record<string, SlashCommand[]> {
  const groups: Record<string, SlashCommand[]> = {};
  for (const cmd of commands) {
    if (!groups[cmd.group]) groups[cmd.group] = [];
    groups[cmd.group].push(cmd);
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

  if (!open || !anchorRect || !mode) return null;

  // Position above the caret
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, anchorRect.left),
    bottom: window.innerHeight - anchorRect.top + 4,
    zIndex: 50,
    width: 320,
  };

  const content = (
    <div
      ref={containerRef}
      style={style}
      data-chat-autocomplete=""
      className="rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2"
    >
      <Command shouldFilter={mode === "slash"} loop>
        {/* Hidden input for cmdk filtering — synced to query */}
        <div className="sr-only">
          <CommandInput value={query} />
        </div>

        <CommandList className="max-h-[280px]">
          <CommandEmpty>
            {mode === "slash" ? "No matching commands" : "No matching entities"}
          </CommandEmpty>

          {mode === "slash" && <SlashCommandItems onSelect={onSelect} />}

          {mode === "mention" && (
            <MentionItems
              results={entityResults}
              loading={entityLoading}
              query={query}
              onSelect={onSelect}
            />
          )}
        </CommandList>
      </Command>
    </div>
  );

  return createPortal(content, document.body);
}

function SlashCommandItems({
  onSelect,
}: {
  onSelect: ChatCommandPopoverProps["onSelect"];
}) {
  const commands = getSlashCommands();
  const groups = groupSlashCommands(commands);
  const groupOrder = ["Actions", "Navigation", "Create", "Utility"];

  return (
    <>
      {groupOrder.map((groupName) => {
        const items = groups[groupName];
        if (!items?.length) return null;
        return (
          <CommandGroup key={groupName} heading={groupName}>
            {items.map((cmd) => (
              <CommandItem
                key={cmd.id}
                value={`${cmd.label} ${cmd.keywords.join(" ")}`}
                onSelect={() =>
                  onSelect({
                    type: "slash",
                    id: cmd.id,
                    label: cmd.label,
                    text: cmd.template ?? cmd.label,
                  })
                }
              >
                <cmd.icon className="h-4 w-4 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm">{cmd.label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {cmd.description}
                  </span>
                </div>
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
  query,
  onSelect,
}: {
  results: EntitySearchResult[];
  loading: boolean;
  query: string;
  onSelect: ChatCommandPopoverProps["onSelect"];
}) {
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching...
      </div>
    );
  }

  if (!query) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
        Type to search entities...
      </div>
    );
  }

  const grouped = groupByType(results);
  const entityTypes = Object.keys(grouped);

  if (entityTypes.length === 0 && !loading) {
    return null; // CommandEmpty will show
  }

  return (
    <>
      {entityTypes.map((type) => {
        const Icon = ENTITY_ICONS[type] ?? FileText;
        const groupLabel = ENTITY_LABELS[type] ?? type;
        return (
          <CommandGroup key={type} heading={groupLabel}>
            {grouped[type].map((entity) => (
              <CommandItem
                key={`${entity.entityType}-${entity.entityId}`}
                value={`${entity.entityType} ${entity.label}`}
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
                <span className="flex-1 truncate">{entity.label}</span>
                {entity.status && (
                  <span className="text-xs text-muted-foreground">
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
