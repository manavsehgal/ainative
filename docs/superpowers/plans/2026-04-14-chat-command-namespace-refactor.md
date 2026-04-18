# Chat Command Namespace Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the chat command grammar so `/` = verbs (Actions/Skills/Tools) and `@` = nouns (Entities/Files), add tabbed navigation inside the `/` popover, wire runtime-aware capability signalling, and unify the `⌘K` palette with skills + files.

**Architecture:** Refactor-in-place of `chat-command-popover.tsx` with a new `CommandTabBar` wrapping the existing cmdk `<Command>` root, preserving a single command root so arrow-key state is never lost on tab switch. Tab partitioning is a pure function over the existing `ToolCatalogEntry` array — testable without a DOM. Capability banner is a separate component that reads `getRuntimeFeatures(runtimeId)`. Per-user tab persistence via `localStorage`, per-session banner dismissal via `sessionStorage`.

**Tech Stack:** React 19, Next.js 16, cmdk (`@/components/ui/command`), Radix Tabs primitives (already in codebase via shadcn), Tailwind v4 with existing tokens, `vitest` + `@testing-library/react` for tests.

---

## NOT in scope

| Deferred | Rationale |
|---|---|
| `#` filter namespace | Covered by `chat-advanced-ux` (P3) |
| Env-integration-backed Skills-tab badges | `chat-environment-integration` still planned; Skills tab ships without badges, lights up when that feature lands |
| File completion under `@` | Already shipped by `chat-file-mentions`; this plan only plugs files into tab structure |
| Migration shim / old-popover fallback | Q7 accepts breaking UX change — alpha product |
| `/export` to PDF or share link | MVP uses existing `/api/documents` POST with markdown body; richer exports later |
| Tools-tab "Advanced reveal" persisted across sessions | Per-session toggle only; avoid a settings row |
| Adding command-palette-enhancement scaffolding | Already shipped at `src/components/shared/command-palette.tsx`; we extend its item list |

## What already exists

| Asset | Path | Reuse strategy |
|---|---|---|
| Popover with slash/mention modes | `src/components/chat/chat-command-popover.tsx` | Wrap body in tab bar, keep cmdk `<Command>` root single-mounted |
| Autocomplete hook | `src/hooks/use-chat-autocomplete.ts` | Add `activeTab` + `setActiveTab` + localStorage init |
| Tool catalog (14 groups) | `src/lib/chat/tool-catalog.ts` | Partition into Actions/Skills/Tools tab buckets |
| Slash commands (actions/nav/create/utility) | `src/lib/chat/slash-commands.ts` | Extend with `/clear`, `/compact`, `/export`, `/help`, `/settings`, `/new-schedule` |
| ⌘K palette (already binds cmd+k) | `src/components/shared/command-palette.tsx` | Add Skills + Files groups |
| Runtime feature flags | `src/lib/agents/runtime/catalog.ts` (`getRuntimeFeatures`) | Drive capability banner + Tools-tab visibility |
| Chat input surface | `src/components/chat/chat-input.tsx` | Inject banner below textarea |
| cmdk primitives + Radix tabs | `src/components/ui/command.tsx`, Radix available | Compose `CommandTabBar` |
| Existing `/api/documents` POST | `src/app/api/documents/route.ts` | Power `/export` MVP |

## Error & Rescue Registry

| # | Error | Trigger | Impact | Rescue |
|---|---|---|---|---|
| 1 | `localStorage` unavailable (SSR, private mode) | First render w/o `window`, Safari private | Tab persistence broken | `try/catch` on read + write, fall back to in-memory default = `"Actions"` |
| 2 | `sessionStorage` write throws (quota) | Banner dismiss click | Dismiss not sticky | `try/catch`; re-evaluate banner next mount silently |
| 3 | Runtime changes mid-stream | Model switch during `isStreaming` | Banner flicker / stale | Hide banner while `isStreaming=true`; recompute on `modelId` change |
| 4 | Tab with zero items after filter | Tools tab on Ollama | Dead-end UX | Empty-state message referencing capability banner below |
| 5 | `CommandEmpty` shows in current tab despite matches in another | Global search query | "No match" hides real matches | Badge tab headers with count `Actions (3)` when query non-empty |
| 6 | ⌘K palette opens while `/` popover is open | User hits ⌘K mid-slash | Double popover / focus war | Close slash popover before palette opens; palette-open event dispatches window event, popover listens |
| 7 | `/export` API call fails | Disk full / 500 | Silent data loss risk | Surface error toast via existing toast system; keep conversation intact; offer retry |
| 8 | `/clear` clicked during active stream | User confusion | Stream orphaned | Disable `/clear` while `isStreaming=true` with tooltip |
| 9 | `⌘L` collides with browser "focus URL bar" (Chrome/FF) | Browser swallow | Shortcut dead | Also bind `⌘⇧L` as documented fallback |
| 10 | `ainative.command-tab` localStorage value corrupt/stale enum | Hand-edit or version drift | Crash on tab render | Validate against enum allowlist; reset to `"Actions"` on mismatch |
| 11 | Skills tab empty for project with no skills | New project | Empty tab feels broken | `EmptyState` with link to docs |
| 12 | Banner wrongly shown on Claude/Codex | `runtimeId` lookup bug | Noise on full-capability runtimes | Unit test covers every `AgentRuntimeId → banner?` |
| 13 | New `ToolGroup` added later not assigned to a tab | Future enum addition | Silent drop from all tabs | `satisfies Record<ToolGroup, TabId>` exhaustiveness guard |
| 14 | Focus lost when tab switch re-mounts `CommandList` | Tab change | Arrow-key position lost | Keep single `<Command>` root; swap only the filtered children, not the root |

## File Structure

**Create:**
- `src/components/chat/command-tab-bar.tsx` — tablist, arrow-key nav, ARIA, count badges
- `src/components/chat/capability-banner.tsx` — single-line dismissible banner
- `src/lib/chat/command-tabs.ts` — tab enum, `ToolGroup → TabId` map, partition pure fn
- `src/lib/chat/__tests__/command-tabs.test.ts` — partition + enum exhaustiveness
- `src/components/chat/__tests__/capability-banner.test.tsx` — banner visibility per runtime
- `src/hooks/__tests__/use-chat-autocomplete-tabs.test.ts` — tab state + localStorage fallback

**Modify:**
- `src/components/chat/chat-command-popover.tsx` — wrap with tab bar, partition items by active tab
- `src/hooks/use-chat-autocomplete.ts` — add `activeTab`, `setActiveTab`, localStorage init
- `src/lib/chat/slash-commands.ts` — add 6 new session commands
- `src/lib/chat/tool-catalog.ts` — add new entries for `/clear`, `/compact`, `/export`, `/help`, `/settings`, `/new-schedule` under a `Session` group
- `src/components/chat/chat-input.tsx` — render `<CapabilityBanner>` below textarea; wire new keyboard shortcuts; execute session commands
- `src/components/shared/command-palette.tsx` — add Skills + Files groups

---

## Task 1: Tab model + partition logic (pure, fully unit-testable)

**Files:**
- Create: `src/lib/chat/command-tabs.ts`
- Test: `src/lib/chat/__tests__/command-tabs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/chat/__tests__/command-tabs.test.ts
import { describe, it, expect } from "vitest";
import {
  COMMAND_TABS,
  GROUP_TO_TAB,
  partitionCatalogByTab,
  isCommandTabId,
  type CommandTabId,
} from "../command-tabs";
import type { ToolCatalogEntry, ToolGroup } from "../tool-catalog";

const entry = (name: string, group: ToolGroup): ToolCatalogEntry => ({
  name,
  description: name,
  group,
});

describe("command-tabs", () => {
  it("exposes four tabs in canonical order", () => {
    expect(COMMAND_TABS.map((t) => t.id)).toEqual([
      "actions",
      "skills",
      "tools",
      "entities",
    ]);
  });

  it("maps every ToolGroup to exactly one tab", () => {
    const groups: ToolGroup[] = [
      "Tasks", "Projects", "Workflows", "Schedules", "Documents", "Tables",
      "Notifications", "Profiles", "Skills", "Usage", "Settings", "Chat",
      "Browser", "Utility",
    ];
    for (const g of groups) {
      expect(GROUP_TO_TAB[g]).toBeDefined();
    }
  });

  it("routes Skills group to the Skills tab", () => {
    expect(GROUP_TO_TAB.Skills).toBe("skills");
  });

  it("routes Browser + Utility to the Tools tab", () => {
    expect(GROUP_TO_TAB.Browser).toBe("tools");
    expect(GROUP_TO_TAB.Utility).toBe("tools");
  });

  it("partitions catalog entries by tab", () => {
    const catalog: ToolCatalogEntry[] = [
      entry("list_tasks", "Tasks"),
      entry("researcher", "Skills"),
      entry("take_screenshot", "Browser"),
    ];
    const part = partitionCatalogByTab(catalog);
    expect(part.actions.map((e) => e.name)).toEqual(["list_tasks"]);
    expect(part.skills.map((e) => e.name)).toEqual(["researcher"]);
    expect(part.tools.map((e) => e.name)).toEqual(["take_screenshot"]);
    expect(part.entities).toEqual([]);
  });

  it("isCommandTabId rejects unknown values", () => {
    expect(isCommandTabId("actions")).toBe(true);
    expect(isCommandTabId("random")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

Run: `npx vitest run src/lib/chat/__tests__/command-tabs.test.ts`
Expected: FAIL — `Cannot find module '../command-tabs'`.

- [ ] **Step 3: Implement `command-tabs.ts`**

```ts
// src/lib/chat/command-tabs.ts
import type { ToolCatalogEntry, ToolGroup } from "./tool-catalog";

export const COMMAND_TAB_IDS = ["actions", "skills", "tools", "entities"] as const;
export type CommandTabId = (typeof COMMAND_TAB_IDS)[number];

export interface CommandTab {
  id: CommandTabId;
  label: string;
  shortcut: string; // ⌘1..⌘4
}

export const COMMAND_TABS: CommandTab[] = [
  { id: "actions", label: "Actions", shortcut: "⌘1" },
  { id: "skills", label: "Skills", shortcut: "⌘2" },
  { id: "tools", label: "Tools", shortcut: "⌘3" },
  { id: "entities", label: "Entities", shortcut: "⌘4" },
];

export const DEFAULT_COMMAND_TAB: CommandTabId = "actions";

export const GROUP_TO_TAB = {
  // ainative actions / session primitives
  Tasks: "actions",
  Projects: "actions",
  Workflows: "actions",
  Schedules: "actions",
  Documents: "actions",
  Tables: "actions",
  Notifications: "actions",
  Profiles: "actions",
  Usage: "actions",
  Settings: "actions",
  Chat: "actions",
  // Skills
  Skills: "skills",
  // Tools (filesystem / system / utility)
  Browser: "tools",
  Utility: "tools",
} satisfies Record<ToolGroup, CommandTabId>;

export function isCommandTabId(value: string): value is CommandTabId {
  return (COMMAND_TAB_IDS as readonly string[]).includes(value);
}

export interface PartitionedCatalog {
  actions: ToolCatalogEntry[];
  skills: ToolCatalogEntry[];
  tools: ToolCatalogEntry[];
  entities: ToolCatalogEntry[];
}

export function partitionCatalogByTab(
  catalog: ToolCatalogEntry[]
): PartitionedCatalog {
  const out: PartitionedCatalog = { actions: [], skills: [], tools: [], entities: [] };
  for (const entry of catalog) {
    out[GROUP_TO_TAB[entry.group]].push(entry);
  }
  return out;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/lib/chat/__tests__/command-tabs.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/command-tabs.ts src/lib/chat/__tests__/command-tabs.test.ts
git commit -m "feat(chat): command-tabs pure partition model (#chat-command-namespace-refactor)"
```

---

## Task 2: Session-command entries in slash commands + tool catalog

**Files:**
- Modify: `src/lib/chat/slash-commands.ts` (add entries after line 132 `actionCommands`)
- Modify: `src/lib/chat/tool-catalog.ts` (add `Session` group + entries)

- [ ] **Step 1: Add `Session` group to tool catalog**

Open `src/lib/chat/tool-catalog.ts`:

Change line 21-35 (`ToolGroup` union) — add `| "Session"`:

```ts
export type ToolGroup =
  | "Tasks"
  | "Projects"
  | "Workflows"
  | "Schedules"
  | "Documents"
  | "Tables"
  | "Notifications"
  | "Profiles"
  | "Skills"
  | "Usage"
  | "Settings"
  | "Chat"
  | "Browser"
  | "Utility"
  | "Session";
```

Add `Session` to `TOOL_GROUP_ICONS` (around line 52-67) — import `Sparkles`/`Zap`. Use `Zap`:

```ts
import { Zap } from "lucide-react";
// ...
Session: Zap,
```

Add `"Session"` to `TOOL_GROUP_ORDER` (line 70-85) — place it first so session commands surface at the top of Actions:

```ts
export const TOOL_GROUP_ORDER: ToolGroup[] = [
  "Session",
  "Tasks",
  "Projects",
  // ...rest unchanged
];
```

Append the new Session entries in `UTILITY_ENTRIES`'s neighborhood — create a new `SESSION_ENTRIES` block before `UTILITY_ENTRIES` (line ~205):

```ts
const SESSION_ENTRIES: ToolCatalogEntry[] = [
  { name: "clear", description: "Start a new conversation", group: "Session", behavior: "execute_immediately" },
  { name: "compact", description: "Summarize and compact conversation history", group: "Session", behavior: "execute_immediately" },
  { name: "export", description: "Save current conversation as a document", group: "Session", behavior: "execute_immediately" },
  { name: "help", description: "Show chat shortcuts and commands", group: "Session", behavior: "execute_immediately" },
  { name: "settings", description: "Open ainative settings", group: "Session", behavior: "execute_immediately" },
  { name: "new-task", description: "Create a new task", group: "Session", paramHint: "title" },
  { name: "new-workflow", description: "Create a new workflow", group: "Session", paramHint: "name" },
  { name: "new-schedule", description: "Create a new schedule", group: "Session", paramHint: "name, interval" },
];
```

Update `getToolCatalog` (line ~215-229) to merge `SESSION_ENTRIES` first:

```ts
export function getToolCatalog(opts?: { includeBrowser?: boolean }): ToolCatalogEntry[] {
  const withBrowser = opts?.includeBrowser ?? false;

  if (withBrowser) {
    if (!cachedWithBrowser) {
      cachedWithBrowser = [...SESSION_ENTRIES, ...STAGENT_TOOLS, ...BROWSER_TOOLS, ...UTILITY_ENTRIES];
    }
    return cachedWithBrowser;
  }

  if (!cachedCatalog) {
    cachedCatalog = [...SESSION_ENTRIES, ...STAGENT_TOOLS, ...UTILITY_ENTRIES];
  }
  return cachedCatalog;
}
```

Update `GROUP_TO_TAB` in `src/lib/chat/command-tabs.ts` to add `Session: "actions"`:

```ts
export const GROUP_TO_TAB = {
  Session: "actions",
  Tasks: "actions",
  // ...rest
} satisfies Record<ToolGroup, CommandTabId>;
```

- [ ] **Step 2: Re-run Task 1 tests for exhaustiveness regression**

Run: `npx vitest run src/lib/chat/__tests__/command-tabs.test.ts`
Expected: PASS.

Add a new case to the test file to lock the new group:

```ts
it("routes Session group to the Actions tab", () => {
  expect(GROUP_TO_TAB.Session).toBe("actions");
});
```

Also extend the existing `maps every ToolGroup to exactly one tab` list to include `"Session"`. Re-run.
Expected: PASS.

- [ ] **Step 3: Verify tool-catalog types compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(tool-catalog|command-tabs)" | head -20`
Expected: empty output (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat/tool-catalog.ts src/lib/chat/command-tabs.ts src/lib/chat/__tests__/command-tabs.test.ts
git commit -m "feat(chat): add Session group and 8 session commands"
```

---

## Task 3: Active-tab state in autocomplete hook (with safe localStorage)

**Files:**
- Modify: `src/hooks/use-chat-autocomplete.ts`
- Test: `src/hooks/__tests__/use-chat-autocomplete-tabs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/__tests__/use-chat-autocomplete-tabs.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatAutocomplete } from "../use-chat-autocomplete";

const TAB_KEY = "ainative.command-tab";

describe("useChatAutocomplete — activeTab persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'actions' when localStorage empty", () => {
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(result.current.activeTab).toBe("actions");
  });

  it("reads persisted tab from localStorage on mount", () => {
    localStorage.setItem(TAB_KEY, "skills");
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(result.current.activeTab).toBe("skills");
  });

  it("ignores corrupt localStorage values", () => {
    localStorage.setItem(TAB_KEY, "bogus");
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(result.current.activeTab).toBe("actions");
  });

  it("persists tab on setActiveTab", () => {
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    act(() => result.current.setActiveTab("tools"));
    expect(result.current.activeTab).toBe("tools");
    expect(localStorage.getItem(TAB_KEY)).toBe("tools");
  });

  it("survives localStorage throwing on write", () => {
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const { result } = renderHook(() => useChatAutocomplete({ projectId: null }));
    expect(() => {
      act(() => result.current.setActiveTab("tools"));
    }).not.toThrow();
    expect(result.current.activeTab).toBe("tools");
    setSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect FAIL (activeTab/setActiveTab don't exist)**

Run: `npx vitest run src/hooks/__tests__/use-chat-autocomplete-tabs.test.ts`
Expected: FAIL with undefined property access on `result.current.activeTab`.

- [ ] **Step 3: Add `activeTab` state to the hook**

Open `src/hooks/use-chat-autocomplete.ts`. Add near the other imports:

```ts
import { isCommandTabId, DEFAULT_COMMAND_TAB, type CommandTabId } from "@/lib/chat/command-tabs";
```

Inside the hook body, add state + helpers:

```ts
const TAB_STORAGE_KEY = "ainative.command-tab";

function readInitialTab(): CommandTabId {
  if (typeof window === "undefined") return DEFAULT_COMMAND_TAB;
  try {
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (raw && isCommandTabId(raw)) return raw;
  } catch {
    // localStorage unavailable — fall through
  }
  return DEFAULT_COMMAND_TAB;
}

const [activeTab, setActiveTabState] = useState<CommandTabId>(readInitialTab);

const setActiveTab = useCallback((tab: CommandTabId) => {
  setActiveTabState(tab);
  try {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // quota / disabled — silent, in-memory only
  }
}, []);
```

Expose `activeTab` and `setActiveTab` in the hook's return object.

- [ ] **Step 4: Re-run tests — expect PASS**

Run: `npx vitest run src/hooks/__tests__/use-chat-autocomplete-tabs.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-chat-autocomplete.ts src/hooks/__tests__/use-chat-autocomplete-tabs.test.ts
git commit -m "feat(chat): activeTab state with safe localStorage persistence"
```

---

## Task 4: `CommandTabBar` component

**Files:**
- Create: `src/components/chat/command-tab-bar.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/chat/command-tab-bar.tsx
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
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep command-tab-bar`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/command-tab-bar.tsx
git commit -m "feat(chat): CommandTabBar component (tablist, arrow-key nav, ARIA)"
```

---

## Task 5: Refactor `chat-command-popover.tsx` to use tabs

**Files:**
- Modify: `src/components/chat/chat-command-popover.tsx`

- [ ] **Step 1: Rewrite the popover to consume `activeTab` + partition**

Replace the existing slash-mode `ToolCatalogItems` call with tab-filtered rendering. Key constraint per E&R row #14: keep a single `<Command>` root; swap only the child groups.

Add new props `activeTab` and `onTabChange` to `ChatCommandPopoverProps`:

```tsx
interface ChatCommandPopoverProps {
  // ...existing props
  activeTab: CommandTabId;
  onTabChange: (tab: CommandTabId) => void;
}
```

Import tab bits:

```tsx
import { CommandTabBar } from "./command-tab-bar";
import { partitionCatalogByTab, type CommandTabId } from "@/lib/chat/command-tabs";
```

Change the slash branch to:

```tsx
{mode === "slash" && (
  <>
    <CommandTabBar activeTab={activeTab} onChange={onTabChange} />
    <div
      role="tabpanel"
      id={`command-tabpanel-${activeTab}`}
      aria-labelledby={`command-tab-${activeTab}`}
    >
      <ToolCatalogItems
        onSelect={onSelect}
        projectProfiles={projectProfiles}
        activeTab={activeTab}
      />
    </div>
  </>
)}
```

Update `ToolCatalogItems` signature to accept `activeTab` and partition:

```tsx
function ToolCatalogItems({
  onSelect,
  projectProfiles,
  activeTab,
}: {
  onSelect: ChatCommandPopoverProps["onSelect"];
  projectProfiles?: ChatCommandPopoverProps["projectProfiles"];
  activeTab: CommandTabId;
}) {
  const catalog = getToolCatalogWithSkills({
    includeBrowser: true,
    projectProfiles,
  });
  const parts = partitionCatalogByTab(catalog);
  const entries = parts[activeTab];

  if (activeTab === "entities") {
    // Entities tab is a pointer — redirect users to '@' mention mode
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground text-center">
        Type <span className="font-mono text-foreground">@</span> to reference projects, tasks, documents, or files.
      </div>
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
```

- [ ] **Step 2: Wire props through `chat-input.tsx`**

In `src/components/chat/chat-input.tsx`, pass the new props to the popover:

```tsx
<ChatCommandPopover
  // ...existing props
  activeTab={autocomplete.activeTab}
  onTabChange={autocomplete.setActiveTab}
  // ...
/>
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(chat-command-popover|chat-input)" | head -20`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/chat-command-popover.tsx src/components/chat/chat-input.tsx
git commit -m "feat(chat): tabbed slash popover (Actions/Skills/Tools/Entities)"
```

---

## Task 6: Capability banner component

**Files:**
- Create: `src/components/chat/capability-banner.tsx`
- Test: `src/components/chat/__tests__/capability-banner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/chat/__tests__/capability-banner.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CapabilityBanner } from "../capability-banner";

describe("CapabilityBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("is hidden on claude-code runtime", () => {
    render(<CapabilityBanner runtimeId="claude-code" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is hidden on openai-codex-app-server runtime", () => {
    render(<CapabilityBanner runtimeId="openai-codex-app-server" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is visible on ollama runtime with capability message", () => {
    render(<CapabilityBanner runtimeId="ollama" />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("file read/write");
  });

  it("hides on dismiss and persists to sessionStorage", () => {
    render(<CapabilityBanner runtimeId="ollama" />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(sessionStorage.getItem("ainative.capability-banner.dismissed.ollama")).toBe("1");
  });

  it("stays dismissed on remount if sessionStorage flag set", () => {
    sessionStorage.setItem("ainative.capability-banner.dismissed.ollama", "1");
    render(<CapabilityBanner runtimeId="ollama" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/components/chat/__tests__/capability-banner.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `capability-banner.tsx`**

```tsx
// src/components/chat/capability-banner.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getRuntimeFeatures, type AgentRuntimeId } from "@/lib/agents/runtime/catalog";
import { cn } from "@/lib/utils";

interface CapabilityBannerProps {
  runtimeId: AgentRuntimeId;
  className?: string;
}

function dismissKey(runtimeId: string): string {
  return `ainative.capability-banner.dismissed.${runtimeId}`;
}

function readDismissed(runtimeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(dismissKey(runtimeId)) === "1";
  } catch {
    return false;
  }
}

export function CapabilityBanner({ runtimeId, className }: CapabilityBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(runtimeId));

  useEffect(() => {
    setDismissed(readDismissed(runtimeId));
  }, [runtimeId]);

  const features = getRuntimeFeatures(runtimeId);
  const limited =
    !features.hasFilesystemTools && !features.hasBash;

  if (!limited || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(dismissKey(runtimeId), "1");
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 px-4 py-1.5 text-xs text-muted-foreground animate-in fade-in-0",
        className
      )}
    >
      <span className="flex-1">
        Features like file read/write, Bash, and hooks are not available on this runtime. Switch models to use them.
      </span>
      <button
        type="button"
        aria-label="Dismiss capability notice"
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 hover:bg-muted"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests — expect PASS**

Run: `npx vitest run src/components/chat/__tests__/capability-banner.test.tsx`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/capability-banner.tsx src/components/chat/__tests__/capability-banner.test.tsx
git commit -m "feat(chat): runtime capability banner"
```

---

## Task 7: Wire banner + session commands + shortcuts into `chat-input.tsx`

**Files:**
- Modify: `src/components/chat/chat-input.tsx`

- [ ] **Step 1: Add runtime resolution helper**

Top of `chat-input.tsx`, add imports:

```tsx
import { CapabilityBanner } from "./capability-banner";
import { resolveAgentRuntime, type AgentRuntimeId } from "@/lib/agents/runtime/catalog";
```

Accept a new prop `runtimeId?: AgentRuntimeId | null` (derive default from `DEFAULT_AGENT_RUNTIME`):

```tsx
interface ChatInputProps {
  // ...existing
  runtimeId?: AgentRuntimeId | null;
}
```

Resolve:

```tsx
const effectiveRuntime = resolveAgentRuntime(runtimeId ?? null);
```

- [ ] **Step 2: Insert banner below the textarea container**

Inside the returned JSX, just below the closing tag of the outer input container (after the `<div>` with the sticky bottom classes but before `<ChatCommandPopover>`), add:

```tsx
{!isStreaming && (
  <div className="mx-auto max-w-3xl">
    <CapabilityBanner runtimeId={effectiveRuntime} />
  </div>
)}
```

- [ ] **Step 3: Implement session command execution in `handlePopoverSelect`**

Extend the `execute_immediately` branch to handle the new session commands. Replace lines ~111-123 with:

```tsx
if (item.type === "slash") {
  const entry = getToolCatalog({ includeBrowser: true }).find((t) => t.name === item.id);
  if (entry?.behavior === "execute_immediately") {
    autocomplete.close();
    setValue("");
    executeSessionCommand(entry.name);
    return;
  }
}
```

Add a helper `executeSessionCommand` inside the component:

```tsx
const executeSessionCommand = useCallback((name: string) => {
  switch (name) {
    case "toggle_theme":
      toggleTheme();
      return;
    case "mark_all_read":
      fetch("/api/notifications/mark-all-read", { method: "PATCH" });
      return;
    case "clear":
      window.dispatchEvent(new CustomEvent("ainative.chat.clear"));
      return;
    case "compact":
      window.dispatchEvent(new CustomEvent("ainative.chat.compact"));
      return;
    case "export":
      window.dispatchEvent(new CustomEvent("ainative.chat.export"));
      return;
    case "help":
      window.dispatchEvent(new CustomEvent("ainative.chat.help"));
      return;
    case "settings":
      window.location.href = "/settings";
      return;
  }
}, []);
```

Rationale: `chat-input` doesn't own conversation state — it dispatches `CustomEvent`s that the parent (`/chat` page) listens for. Parent wiring is in Task 8. Events are testable via `addEventListener` mocks.

- [ ] **Step 4: Add keyboard shortcuts (⌘L, ⌘⇧L, ⌘/)**

Modify `handleKeyDown` to intercept `⌘L` / `⌘⇧L` (clear) and `⌘/` (focus chat — it's already focused when this fires, so the effect is opening the slash popover):

```tsx
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (autocomplete.handleKeyDown(e)) return;

    const cmd = e.metaKey || e.ctrlKey;
    if (cmd && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      if (!isStreaming) executeSessionCommand("clear");
      return;
    }
    if (cmd && e.key === "/") {
      e.preventDefault();
      textareaRef.current?.focus();
      setValue((v) => (v.startsWith("/") ? v : "/" + v));
      requestAnimationFrame(() => {
        if (textareaRef.current) autocomplete.handleChange(textareaRef.current.value, textareaRef.current);
      });
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      textareaRef.current?.blur();
    }
  },
  [handleSend, autocomplete, executeSessionCommand, isStreaming]
);
```

Note: `⌘⏎` (send) already works because `Enter` without shift sends. `⌘` modifier on Enter is a superset.

- [ ] **Step 5: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep chat-input | head -20`
Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/chat-input.tsx
git commit -m "feat(chat): capability banner + session command dispatch + ⌘L ⌘/ shortcuts"
```

---

## Task 8: Parent chat page handles `ainative.chat.*` events

**Files:**
- Modify: `src/app/chat/page.tsx` (or the parent that owns conversation state — grep first)

- [ ] **Step 1: Locate chat state owner**

```bash
grep -rn "setMessages\|setConversationId\|handleClear" src/app/chat/ src/components/chat/ | head -20
```

Identify the component that owns `messages` state and has access to the conversation ID + runtime. Likely `src/app/chat/page.tsx` or `src/components/chat/chat-shell.tsx`.

- [ ] **Step 2: Add event listeners for `clear`, `compact`, `export`, `help`**

In the identified file, inside a `useEffect` (client component):

```tsx
useEffect(() => {
  const handleClear = () => {
    // existing "new conversation" logic
    startNewConversation();
  };
  const handleCompact = () => {
    // existing compact action
    compactConversation();
  };
  const handleExport = async () => {
    const markdown = serializeConversationToMarkdown(messages);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Chat — ${new Date().toISOString().slice(0, 10)}.md`,
          content: markdown,
          mimeType: "text/markdown",
        }),
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      toast.success("Conversation exported to documents");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  };
  const handleHelp = () => setHelpDialogOpen(true);

  window.addEventListener("ainative.chat.clear", handleClear);
  window.addEventListener("ainative.chat.compact", handleCompact);
  window.addEventListener("ainative.chat.export", handleExport);
  window.addEventListener("ainative.chat.help", handleHelp);

  return () => {
    window.removeEventListener("ainative.chat.clear", handleClear);
    window.removeEventListener("ainative.chat.compact", handleCompact);
    window.removeEventListener("ainative.chat.export", handleExport);
    window.removeEventListener("ainative.chat.help", handleHelp);
  };
}, [messages, startNewConversation, compactConversation]);
```

If `serializeConversationToMarkdown` doesn't exist, implement a minimal version inline:

```ts
function serializeConversationToMarkdown(msgs: Array<{ role: string; content: string }>): string {
  return msgs.map((m) => `### ${m.role === "user" ? "You" : "Assistant"}\n\n${m.content}`).join("\n\n---\n\n");
}
```

If no `toast` system is imported, use `sonner` (already a dep — grep to confirm).

- [ ] **Step 3: Add Help dialog**

Create `src/components/chat/help-dialog.tsx`:

```tsx
"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat shortcuts</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-2 text-sm">
          <Row k="/" v="Open actions / skills / tools menu" />
          <Row k="@" v="Reference a project, task, document, or file" />
          <Row k="⌘K" v="Open global command palette" />
          <Row k="⌘/" v="Focus chat input and open slash menu" />
          <Row k="⌘L" v="Clear conversation (new session)" />
          <Row k="⌘⇧L" v="Clear conversation (browser fallback)" />
          <Row k="⌘⏎" v="Send message" />
          <Row k="↑ ↓" v="Navigate popover items" />
          <Row k="Esc" v="Close popover" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3">
      <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
      <span className="text-muted-foreground">{v}</span>
    </div>
  );
}
```

Remember the `px-6 pb-6` Sheet/Dialog body-padding convention from MEMORY.md.

Mount `<HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />` in the chat parent.

Also add the `⌘⇧L` handler alongside `⌘L` in `chat-input.tsx` (it already fires because the check `e.key === "l" || "L"` matches Shift+L).

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(chat/page|chat-shell|help-dialog)" | head -20`
Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add src/app/chat/ src/components/chat/help-dialog.tsx
git commit -m "feat(chat): wire /clear /compact /export /help events + Help dialog"
```

---

## Task 9: Extend `⌘K` command palette with Skills + Files

**Files:**
- Modify: `src/components/shared/command-palette.tsx`

- [ ] **Step 1: Audit the palette file**

Read `src/components/shared/command-palette.tsx` in full before editing; it already has Recent Projects, Recent Tasks, and Playbooks groups.

- [ ] **Step 2: Add Skills group**

Import:

```ts
import { useProjectSkills } from "@/hooks/use-project-skills";
import { Sparkles } from "lucide-react";
```

Inside the component, read skills (projectId scope — use null/current):

```ts
const { skills } = useProjectSkills(null);
```

Add a `<CommandGroup heading="Skills">` rendering each skill with `<Sparkles>` icon. Clicking a skill closes the palette and dispatches a `CustomEvent("ainative.chat.activate-skill", { detail: { id: skill.id } })`.

- [ ] **Step 3: Add Files group**

Reuse the entity-detector endpoint that `chat-file-mentions` uses. Grep first:

```bash
grep -rn "entity.*file\|FileCode" src/hooks src/app/api | head
```

Identify the file-search API route; call it on-demand when the palette's input value matches a file-like pattern. Debounce with `useRef<number>` timeout (200ms) to avoid network thrash.

Render matches as a `<CommandGroup heading="Files">` with `<FileCode>` icon. Selection closes palette and dispatches `CustomEvent("ainative.chat.insert-mention", { detail: { type: "file", path } })` — the chat input's mention logic in `use-chat-autocomplete.ts` listens for this (add listener in that hook).

- [ ] **Step 4: Add listener in `use-chat-autocomplete.ts`**

```ts
useEffect(() => {
  function handleInsertMention(e: CustomEvent<{ type: string; path: string }>) {
    // Append `@path ` to textarea value and register mention
    // reuse existing handleSelect logic
  }
  window.addEventListener("ainative.chat.insert-mention", handleInsertMention as EventListener);
  return () => window.removeEventListener("ainative.chat.insert-mention", handleInsertMention as EventListener);
}, []);
```

- [ ] **Step 5: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "(command-palette|use-chat-autocomplete)" | head -20`
Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/command-palette.tsx src/hooks/use-chat-autocomplete.ts
git commit -m "feat(palette): add Skills + Files groups to ⌘K palette"
```

---

## Task 10: `/frontend-designer` review checkpoint

**Rationale:** Spec line 20 mandates sign-off before implementation is considered complete. Do this after code is green and before merging.

- [ ] **Step 1: Run the design review agent**

Dispatch the `frontend-designer` agent with this brief:

> Review the chat command popover refactor on branch `chat-command-namespace-refactor`. Files: `src/components/chat/command-tab-bar.tsx`, `src/components/chat/chat-command-popover.tsx`, `src/components/chat/capability-banner.tsx`, `src/components/chat/help-dialog.tsx`, `src/components/chat/chat-input.tsx`. Target metrics per spec §7: DV 3-4, MI 2, VD 7. Verify: tab bar follows Sheet/Dialog visual language, focus-visible rings present, fade-in-only animation, monospace for file paths in `@` mode, keyboard accessibility (arrow keys, focus trap, ARIA labels on tabs + items). Report pass/fail per criterion with screenshots where helpful.

- [ ] **Step 2: Record sign-off or address findings**

If findings are returned, open them as additional steps inside this task (amend the plan) and address each. Paste the final sign-off summary into the feature spec's Verification section.

- [ ] **Step 3: Commit any design-review follow-ups**

```bash
git add <files>
git commit -m "refactor(chat): address frontend-designer review findings"
```

---

## Task 11: Browser smoke test

- [ ] **Step 1: Start dev server**

```bash
PORT=3010 npm run dev
```

Wait for "Ready" in the log.

- [ ] **Step 2: Open chat in Claude in Chrome (or Playwright fallback)**

Navigate to `http://localhost:3010/chat`. Verify:

- [ ] Type `/` → popover opens with tab bar visible, `Actions` tab selected.
- [ ] Arrow right → `Skills` tab, arrow right → `Tools`, arrow right → `Entities`, arrow right wraps back to `Actions`.
- [ ] Click `Tools` tab on Claude runtime → shows Browser + Utility groups.
- [ ] Switch model to Ollama (if available) → capability banner appears below input.
- [ ] Click dismiss (X) on banner → banner disappears.
- [ ] Reload page → banner stays dismissed (sessionStorage).
- [ ] Switch back to Claude runtime → banner absent.
- [ ] Type `/clear` + Enter → new conversation starts (messages clear).
- [ ] Type `/help` + Enter → Help dialog opens with shortcut table.
- [ ] `⌘K` → global palette opens with Skills group visible.
- [ ] `⌘L` → clears conversation (fallback `⌘⇧L` if browser swallows).
- [ ] Type `@` → mention popover (no tabs, existing behavior).
- [ ] `/export` → toast "Conversation exported to documents"; verify row in `/documents`.

- [ ] **Step 3: Capture screenshot for PR**

```bash
# Via Claude in Chrome or Playwright — save to /tmp
```

Save to `/tmp/chat-command-refactor-smoke.png`.

- [ ] **Step 4: Stop dev server**

`pkill -f "next dev.*3010"`.

---

## Task 12: Full test suite + typecheck

- [ ] **Step 1: Run full vitest**

Run: `npm test -- --run`
Expected: all passing. Fix any regression before proceeding.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: no new errors.

---

## Task 13: Update feature spec + changelog

**Files:**
- Modify: `features/chat-command-namespace-refactor.md`
- Modify: `features/changelog.md`
- Modify: `features/roadmap.md`

- [ ] **Step 1: Flip spec to `completed` with verification note**

In `features/chat-command-namespace-refactor.md`, change `status: planned` → `status: completed`. Append a Verification section with:

- Date of smoke run
- Runtime matrix checked (Claude, Codex, Ollama)
- `/frontend-designer` sign-off summary

- [ ] **Step 2: Append to changelog**

Under today's date in `features/changelog.md`, add:

```markdown
### Chat — Command Namespace Refactor
- `/` popover now tabbed (Actions / Skills / Tools / Entities).
- New session commands: `/clear`, `/compact`, `/export`, `/help`, `/settings`, `/new-task`, `/new-workflow`, `/new-schedule`.
- Capability hint banner on runtimes without filesystem/Bash tools.
- `⌘K` palette extended with Skills and Files groups.
- Keyboard: `⌘L` (clear), `⌘⇧L` (fallback), `⌘/` (focus + slash).
- **Breaking:** old flat slash popover replaced. Per Q7, no deprecation shim (alpha).
```

- [ ] **Step 3: Update roadmap**

Move `chat-command-namespace-refactor` from planned to completed in `features/roadmap.md`.

- [ ] **Step 4: Commit**

```bash
git add features/
git commit -m "docs(features): mark chat-command-namespace-refactor complete"
```

---

## Task 14: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin chat-command-namespace-refactor
```

- [ ] **Step 2: Open PR via gh**

```bash
gh pr create --title "feat(chat): command namespace refactor (/ = verbs, @ = nouns)" --body "$(cat <<'EOF'
## Summary
- Tabbed `/` popover: Actions / Skills / Tools / Entities
- Runtime capability banner (Ollama signals limits; Claude/Codex silent)
- New session commands: /clear /compact /export /help /settings /new-task /new-workflow /new-schedule
- ⌘K palette extended with Skills + Files
- Keyboard: ⌘L, ⌘⇧L, ⌘/

Breaking UX change accepted per spec Q7 (alpha product, no deprecation shim).

## Frontend-designer sign-off
[paste summary from Task 10 here]

## Test plan
- [x] Unit: partition, tab persistence, banner visibility matrix, storage fallback
- [x] Typecheck + lint clean
- [x] Browser smoke: Claude + Ollama runtimes, all 12 interactions in Task 11

EOF
)"
```

---

## Self-Review

- **Spec coverage:** AC 1 (tabbed) → Task 5; AC 2 (@ entities+files) → existing + Task 9; AC 3 (Skills badges) → explicitly deferred in NOT-in-scope; AC 4 (Tools "Advanced") → Tools tab visible always (simplified — user approved); AC 5 (new commands) → Task 2+7+8; AC 6 (banner) → Task 6+7; AC 7 (⌘K unified) → Task 9; AC 8 (shortcut table) → Task 7+8; AC 9 (CommandTabBar visuals + a11y) → Task 4+10; AC 10 (taste metrics DV/MI/VD) → Task 10; AC 11 (`/frontend-designer` sign-off) → Task 10; AC 12 (breaking change in changelog) → Task 13.

  **Gap noted:** AC 4 "Tools tab hidden behind 'Advanced' reveal by default" was softened to "Tools tab visible always" during brainstorming/scope approval — this is a documented deviation from spec. If the user wants strict AC, add a toggle button in `CommandTabBar` that collapses the Tools tab unless clicked. Flag this before closing the PR.

- **Placeholder scan:** No TBDs. Exception: Task 8 Step 1 begins with a `grep` to locate the exact file — the step commits the caller to reading it and using the returned path. Acceptable scaffolding, not a placeholder, because Step 2 gives the exact code.

- **Type consistency:** `CommandTabId`, `COMMAND_TABS`, `GROUP_TO_TAB`, `partitionCatalogByTab`, `isCommandTabId`, `DEFAULT_COMMAND_TAB` all exported from `command-tabs.ts` and consistently referenced in Tasks 3, 4, 5. `CapabilityBanner` prop `runtimeId: AgentRuntimeId` consistent across Tasks 6 and 7. Event names `ainative.chat.{clear,compact,export,help,activate-skill,insert-mention}` consistent between dispatcher (Task 7) and listeners (Task 8, 9).
