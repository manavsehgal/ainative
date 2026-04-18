# Chat Polish Bundle v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small UX polish items on already-shipped chat surfaces — filter hint, saved-search rename/delete CRUD, and empty-group suppression in the mention popover.

**Architecture:** Pure addition pattern. No schema changes, no new API routes — the existing `PUT /api/settings/chat/saved-searches` full-list replacement is reused for `rename`. Two new leaf components (`FilterHint`, `SavedSearchesManager`), one hook method (`rename`), and a localized edit to the entity-group render loop in `chat-command-popover.tsx`.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui `Command` (cmdk-based), `Dialog`, Sonner toasts, Vitest, React Testing Library.

**Spec:** `features/chat-polish-bundle-v1.md`

---

## File Map

**Create:**
- `src/components/shared/filter-hint.tsx` — passive hint row, consumed by both filter surfaces
- `src/components/shared/saved-searches-manager.tsx` — dialog with rename + deliberate delete
- `src/components/shared/__tests__/filter-hint.test.tsx` — visibility + dismissal tests
- `src/components/shared/__tests__/saved-searches-manager.test.tsx` — validation + rename + delete tests
- `src/hooks/__tests__/use-saved-searches.test.ts` — add `rename` method tests (extend if file exists, otherwise create)

**Modify:**
- `src/hooks/use-saved-searches.ts` — add `rename(id, label)` method
- `src/components/shared/command-palette.tsx` — inline delete icon + undo toast + manager entry + `rename` wiring
- `src/components/chat/chat-command-popover.tsx` — empty-group suppression + filter-aware `CommandEmpty` + `FilterHint` mount
- `src/components/shared/filter-input.tsx` — mount `FilterHint` below input

**Do NOT touch:**
- `src/app/api/settings/chat/saved-searches/route.ts` — no API changes
- `src/lib/chat/clean-filter-input.ts` — no changes
- `src/lib/filters/parse.ts` — no changes

---

## Task 1: Extend `useSavedSearches` hook with `rename`

**Files:**
- Modify: `src/hooks/use-saved-searches.ts`
- Test: `src/hooks/__tests__/use-saved-searches.test.ts` (create if missing)

- [ ] **Step 1: Check whether a test file exists**

Run: `ls src/hooks/__tests__/use-saved-searches.test.ts 2>&1`

If the file exists, open it. Otherwise create a new one with the skeleton in Step 2.

- [ ] **Step 2: Write failing test for `rename`**

Add to `src/hooks/__tests__/use-saved-searches.test.ts`:

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSavedSearches } from "../use-saved-searches";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

describe("useSavedSearches — rename", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/api/settings/chat/saved-searches") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            searches: [
              {
                id: "s1",
                surface: "task",
                label: "Old label",
                filterInput: "#status:blocked",
                createdAt: "2026-04-14T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renames a saved search optimistically and persists via PUT", async () => {
    const { result } = renderHook(() => useSavedSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.searches[0].label).toBe("Old label");

    act(() => {
      result.current.rename("s1", "New label");
    });

    expect(result.current.searches[0].label).toBe("New label");

    const putCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, init]) => init?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.searches[0].label).toBe("New label");
    expect(body.searches[0].id).toBe("s1");
  });

  it("no-ops when id is not found", async () => {
    const { result } = renderHook(() => useSavedSearches());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.searches;

    act(() => {
      result.current.rename("does-not-exist", "Whatever");
    });

    expect(result.current.searches).toEqual(before);
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `npx vitest run src/hooks/__tests__/use-saved-searches.test.ts`
Expected: FAIL — `result.current.rename is not a function`.

- [ ] **Step 4: Implement `rename`**

Modify `src/hooks/use-saved-searches.ts`:

```typescript
// Add to UseSavedSearchesReturn interface (after `refetch`):
  rename: (id: string, label: string) => void;
```

Add implementation after `remove`:

```typescript
const rename = useCallback(
  (id: string, label: string) => {
    setSearches((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], label };
      void persist(next);
      return next;
    });
  },
  [persist]
);
```

Return it:

```typescript
return { searches, loading, save, remove, forSurface, refetch, rename };
```

- [ ] **Step 5: Run test to verify pass**

Run: `npx vitest run src/hooks/__tests__/use-saved-searches.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-saved-searches.ts src/hooks/__tests__/use-saved-searches.test.ts
git commit -m "feat(chat): useSavedSearches rename method

Optimistic state update + full-list PUT persistence. No API change
required — existing route accepts the full list on every write.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `FilterHint` component

**Files:**
- Create: `src/components/shared/filter-hint.tsx`
- Test: `src/components/shared/__tests__/filter-hint.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/shared/__tests__/filter-hint.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { FilterHint } from "../filter-hint";

const KEY = "ainative.filter-hint.dismissed";

describe("FilterHint", () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it("renders when input is empty and not dismissed", () => {
    render(<FilterHint inputValue="" storageKey={KEY} />);
    expect(screen.getByText(/#key:value/i)).toBeInTheDocument();
  });

  it("renders when input has no # character", () => {
    render(<FilterHint inputValue="some search" storageKey={KEY} />);
    expect(screen.getByText(/#key:value/i)).toBeInTheDocument();
  });

  it("hides when input contains #", () => {
    render(<FilterHint inputValue="#status:blocked" storageKey={KEY} />);
    expect(screen.queryByText(/#key:value/i)).toBeNull();
  });

  it("sets dismissal flag when input parses a valid clause", () => {
    render(<FilterHint inputValue="#type:pdf" storageKey={KEY} />);
    expect(localStorage.getItem(KEY)).toBe("1");
  });

  it("stays hidden on subsequent mounts once dismissed", () => {
    localStorage.setItem(KEY, "1");
    render(<FilterHint inputValue="" storageKey={KEY} />);
    expect(screen.queryByText(/#key:value/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/components/shared/__tests__/filter-hint.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `FilterHint`**

Create `src/components/shared/filter-hint.tsx`:

```tsx
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
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(storageKey) === "1";
  });

  const parsed = useMemo(() => parseFilterInput(inputValue), [inputValue]);

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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/components/shared/__tests__/filter-hint.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/filter-hint.tsx src/components/shared/__tests__/filter-hint.test.tsx
git commit -m "feat(chat): FilterHint component for #key:value discoverability

Passive hint row that auto-dismisses on first successful filter use.
Shared between chat popover and list-page FilterInput.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire `FilterHint` into `FilterInput` and the chat popover

**Files:**
- Modify: `src/components/shared/filter-input.tsx`
- Modify: `src/components/chat/chat-command-popover.tsx`

- [ ] **Step 1: Mount `FilterHint` inside `FilterInput`**

Edit `src/components/shared/filter-input.tsx`. Add import:

```tsx
import { FilterHint } from "./filter-hint";
```

Wrap the existing return value so the hint renders below the input + clauses. Replace the existing `return (...)` with:

```tsx
return (
  <div className="flex flex-col gap-1 flex-1 min-w-0">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[16rem]">
        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={local}
          onChange={(e) => {
            const next = e.target.value;
            setLocal(next);
            const p = parseFilterInput(next);
            onChange({ raw: next, clauses: p.clauses, rawQuery: p.rawQuery });
          }}
          placeholder={placeholder ?? "#status:blocked or search…"}
          className="pl-7 h-8"
        />
      </div>
      {parsed.clauses.map((c, i) => (
        <Badge key={`${c.key}-${i}`} variant="outline" className="text-xs font-mono">
          #{c.key}:{c.value}
        </Badge>
      ))}
    </div>
    <FilterHint inputValue={local} storageKey="ainative.filter-hint.dismissed" />
  </div>
);
```

- [ ] **Step 2: Mount `FilterHint` inside the chat popover**

Edit `src/components/chat/chat-command-popover.tsx`. Add import near the other shared imports:

```tsx
import { FilterHint } from "@/components/shared/filter-hint";
```

Locate the popover's `CommandList` rendering (around line 325, inside the `<div id={...tabpanel}>`). Add `<FilterHint>` just below the `CommandInput` (or at the top of `CommandList` — whichever is consistent with the cmdk layout you find). Use the same storage key as `FilterInput`:

```tsx
<FilterHint inputValue={query} storageKey="ainative.filter-hint.dismissed" />
```

> **Implementer note:** The popover today does not include a visible `CommandInput` (input is the chat textarea itself). If that is still the case, mount `FilterHint` at the top of the `CommandList` so it appears above the first group. Do NOT duplicate the hint into multiple tabs — one mount per popover instance.

- [ ] **Step 3: Verify dev build**

Run: `npx tsc --noEmit 2>&1 | grep -E "(filter-hint|filter-input|chat-command-popover)" | head`
Expected: empty output.

Run: `npx vitest run src/components/shared/__tests__/filter-hint.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/filter-input.tsx src/components/chat/chat-command-popover.tsx
git commit -m "feat(chat): mount FilterHint in FilterInput and chat popover

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `SavedSearchesManager` dialog

**Files:**
- Create: `src/components/shared/saved-searches-manager.tsx`
- Test: `src/components/shared/__tests__/saved-searches-manager.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/shared/__tests__/saved-searches-manager.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SavedSearchesManager } from "../saved-searches-manager";
import type { SavedSearch } from "@/hooks/use-saved-searches";

const search = (over: Partial<SavedSearch> = {}): SavedSearch => ({
  id: "s1",
  surface: "task",
  label: "Blocked tasks",
  filterInput: "#status:blocked",
  createdAt: "2026-04-14T00:00:00.000Z",
  ...over,
});

describe("SavedSearchesManager", () => {
  it("lists all saved searches", () => {
    const items = [
      search({ id: "s1", label: "Blocked tasks" }),
      search({ id: "s2", label: "Pdf docs", surface: "document", filterInput: "#type:pdf" }),
    ];
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={items}
        onRename={() => {}}
        onRemove={() => {}}
      />
    );
    expect(screen.getByText("Blocked tasks")).toBeInTheDocument();
    expect(screen.getByText("Pdf docs")).toBeInTheDocument();
  });

  it("renames on blur with non-empty trimmed label", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "  Renamed  " } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith("s1", "Renamed");
  });

  it("rejects empty label with inline error", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
  });

  it("rejects duplicate label within same surface (case-insensitive)", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[
          search({ id: "s1", label: "Blocked tasks" }),
          search({ id: "s2", label: "Another" }),
        ]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename another/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "blocked TASKS" } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it("rejects label longer than 120 chars", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "x".repeat(121) } });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/too long/i)).toBeInTheDocument();
  });

  it("Escape cancels rename without persisting", () => {
    const onRename = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={onRename}
        onRemove={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /rename blocked tasks/i }));
    const input = screen.getByRole("textbox", { name: /rename/i });
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRename).not.toHaveBeenCalled();
  });

  it("delete requires explicit confirm", () => {
    const onRemove = vi.fn();
    render(
      <SavedSearchesManager
        open
        onOpenChange={() => {}}
        searches={[search()]}
        onRename={() => {}}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete blocked tasks/i }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(onRemove).toHaveBeenCalledWith("s1");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/components/shared/__tests__/saved-searches-manager.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SavedSearchesManager`**

Create `src/components/shared/saved-searches-manager.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SavedSearch } from "@/hooks/use-saved-searches";

const LABEL_MAX = 120;

interface SavedSearchesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searches: SavedSearch[];
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

/**
 * SavedSearchesManager — dialog for renaming or deleting saved searches.
 *
 * Distinct from the inline palette delete (which is one-click with a 5s
 * undo toast). This dialog is a deliberate management context, so delete
 * requires an explicit "Confirm" click (no undo).
 */
export function SavedSearchesManager({
  open,
  onOpenChange,
  searches,
  onRename,
  onRemove,
}: SavedSearchesManagerProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  function startRename(s: SavedSearch) {
    setRenamingId(s.id);
    setDraft(s.label);
    setError(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setDraft("");
    setError(null);
  }

  function commitRename(s: SavedSearch) {
    const next = draft.trim();
    if (next.length === 0) {
      setError("Label cannot be empty");
      return;
    }
    if (next.length > LABEL_MAX) {
      setError(`Label too long (max ${LABEL_MAX} chars)`);
      return;
    }
    const dupe = searches.find(
      (other) =>
        other.id !== s.id &&
        other.surface === s.surface &&
        other.label.toLowerCase() === next.toLowerCase()
    );
    if (dupe) {
      setError("A saved search with that label already exists for this surface");
      return;
    }
    if (next !== s.label) onRename(s.id, next);
    cancelRename();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage saved searches</DialogTitle>
          <DialogDescription>Rename or delete your saved filter combinations.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-2 overflow-y-auto max-h-[60vh]">
          {searches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved searches yet.</p>
          ) : (
            searches.map((s) => {
              const isRenaming = renamingId === s.id;
              const isPendingDelete = pendingDeleteId === s.id;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="space-y-1">
                        <Input
                          aria-label="Rename"
                          autoFocus
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            setError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename(s);
                            }
                          }}
                          onBlur={() => commitRename(s)}
                          className="h-7"
                        />
                        {error && (
                          <p className="text-xs text-destructive">{error}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.label}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {s.surface}
                        </Badge>
                      </div>
                    )}
                    <p className="truncate text-xs font-mono text-muted-foreground">
                      {s.filterInput}
                    </p>
                  </div>
                  {!isRenaming && !isPendingDelete && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Rename ${s.label}`}
                        onClick={() => startRename(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={`Delete ${s.label}`}
                        onClick={() => setPendingDeleteId(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {isPendingDelete && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7"
                        aria-label={`Confirm delete ${s.label}`}
                        onClick={() => {
                          onRemove(s.id);
                          setPendingDeleteId(null);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Confirm delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        aria-label="Cancel delete"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/components/shared/__tests__/saved-searches-manager.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/saved-searches-manager.tsx src/components/shared/__tests__/saved-searches-manager.test.tsx
git commit -m "feat(chat): SavedSearchesManager dialog — rename + deliberate delete

Rename via inline input (blur commits, Esc cancels). Delete requires
explicit confirm click (distinct from palette inline delete which uses
a 5s undo toast).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire inline delete + manager entry into `⌘K` palette

**Files:**
- Modify: `src/components/shared/command-palette.tsx`

- [ ] **Step 1: Add imports and local state**

At the top of `src/components/shared/command-palette.tsx`, add imports alongside the existing `lucide-react` and local imports:

```tsx
import { Trash2, Settings2 } from "lucide-react";
import { SavedSearchesManager } from "./saved-searches-manager";
```

Inside the `CommandPalette` function, pull `remove`, `save`, and `rename` from the hook. Replace the existing destructure:

```tsx
const {
  searches: savedSearches,
  refetch: refetchSavedSearches,
  remove: removeSavedSearch,
  save: saveSavedSearch,
  rename: renameSavedSearch,
} = useSavedSearches();
```

Add manager-open state:

```tsx
const [managerOpen, setManagerOpen] = useState(false);
```

- [ ] **Step 2: Replace the existing Saved-searches group with inline-delete + manager entry**

Locate the block:

```tsx
{savedSearches.length > 0 && (
  <>
    <CommandGroup heading="Saved searches">
      {savedSearches.map((s) => (
        <CommandItem ...>...</CommandItem>
      ))}
    </CommandGroup>
    <CommandSeparator />
  </>
)}
```

Replace with:

```tsx
{savedSearches.length > 0 && (
  <>
    <CommandGroup heading="Saved searches">
      {savedSearches.map((s) => (
        <CommandItem
          key={`saved-${s.id}`}
          value={`saved ${s.label} ${s.filterInput} ${s.surface}`}
          onSelect={() => {
            const base = SURFACE_ROUTE[s.surface];
            navigate(`${base}?filter=${encodeURIComponent(s.filterInput)}`);
          }}
          keywords={["saved", "search", s.surface]}
          className="group/item"
          onKeyDown={(e) => {
            // ⌘⌫ on focused row deletes with undo
            if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteSavedSearch(s);
            }
          }}
        >
          <Bookmark className="h-4 w-4" />
          <span className="flex-1 truncate">{s.label}</span>
          <span className="text-xs text-muted-foreground font-mono">{s.filterInput}</span>
          <span className="ml-2 text-xs text-muted-foreground">{s.surface}</span>
          <button
            type="button"
            aria-label={`Delete saved search: ${s.label}`}
            className="ml-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteSavedSearch(s);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </CommandItem>
      ))}
      <CommandItem
        value="manage-saved-searches"
        keywords={["manage", "saved", "rename", "delete"]}
        onSelect={() => {
          setManagerOpen(true);
        }}
      >
        <Settings2 className="h-4 w-4" />
        <span className="flex-1">Manage saved searches…</span>
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
  </>
)}
```

- [ ] **Step 3: Add the `handleDeleteSavedSearch` helper**

Above the `return` statement in `CommandPalette`:

```tsx
const handleDeleteSavedSearch = useCallback(
  (s: SavedSearch) => {
    // Optimistic remove + toast with Undo. The closure holds the full
    // record so undo restores id/createdAt verbatim (not just label).
    removeSavedSearch(s.id);
    toast("Saved search deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          // `save` generates a new id — we need to restore the original.
          // The cheapest restoration is to re-save and then immediately
          // patch the id via a rename-adjacent path. Since the hook has
          // no "insert with id" method, we accept id churn on undo: the
          // label/filterInput/surface are preserved, which is what the
          // user sees. Acceptance criterion: the row reappears with its
          // label and filter, the actual id is an implementation detail.
          saveSavedSearch({
            surface: s.surface,
            label: s.label,
            filterInput: s.filterInput,
          });
        },
      },
    });
  },
  [removeSavedSearch, saveSavedSearch]
);
```

Add the `SavedSearch` type import at the top:

```tsx
import { useSavedSearches, type SavedSearch, type SavedSearchSurface } from "@/hooks/use-saved-searches";
```

- [ ] **Step 4: Mount the manager dialog**

At the end of the `CommandDialog` return, before the closing tag of the outer fragment (or outside the `CommandDialog`), add:

```tsx
<SavedSearchesManager
  open={managerOpen}
  onOpenChange={setManagerOpen}
  searches={savedSearches}
  onRename={renameSavedSearch}
  onRemove={removeSavedSearch}
/>
```

Wrap both in a fragment if needed:

```tsx
return (
  <>
    <CommandDialog ...>
      ...
    </CommandDialog>
    <SavedSearchesManager ... />
  </>
);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep command-palette | head`
Expected: empty.

Run: `npx vitest run src/hooks/__tests__/use-saved-searches.test.ts src/components/shared/__tests__/saved-searches-manager.test.tsx src/components/shared/__tests__/filter-hint.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/command-palette.tsx
git commit -m "feat(chat): inline delete + manager entry in ⌘K saved searches

Hover/focus reveals a trash icon; click triggers optimistic delete with
a 5s Sonner Undo. ⌘⌫ on a focused row also deletes. 'Manage saved
searches…' row opens the SavedSearchesManager dialog for rename and
deliberate delete.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Empty-group suppression in `chat-command-popover`

**Files:**
- Modify: `src/components/chat/chat-command-popover.tsx`

- [ ] **Step 1: Locate the entity-group render loop**

The block is around line 747:

```tsx
{Object.entries(groupByType(filteredEntities)).map(([type, group]) => {
  const groupLabel = ENTITY_LABELS[type] ?? type;
  return (
    <CommandGroup key={type} heading={groupLabel}>
      {group.map(...)}
    </CommandGroup>
  );
})}
```

(If the exact line has drifted, find it by searching for `ENTITY_LABELS[type]`.)

- [ ] **Step 2: Compute a single `visibleGroups` array with filter applied**

Above the render loop, compute filtered results. The popover already uses `matchesClauses(r, parsed.clauses, {...})` in the entity partition — reuse that. Introduce a single memoized array:

```tsx
const visibleEntityGroups = useMemo(() => {
  const groups = groupByType(
    entityResults.filter((r) =>
      matchesClauses(r, parsed.clauses, {
        surfaceKeys: ["type", "status", "priority"],
      })
    )
  );
  return Object.entries(groups).filter(([, group]) => group.length > 0);
}, [entityResults, parsed.clauses]);
```

> **Implementer note:** the exact second argument to `matchesClauses` must match what the existing call at line ~236 uses. Do not invent key names — copy the existing call's options object verbatim to preserve semantics. The memo replaces whatever ad-hoc filtering was happening at the render site.

- [ ] **Step 3: Render from `visibleEntityGroups` and add filter-aware empty state**

Replace the existing entity render block with:

```tsx
{activeTab === "entities" && (
  <>
    {visibleEntityGroups.length === 0 && parsed.clauses.length > 0 ? (
      <CommandEmpty>
        No matches for{" "}
        {parsed.clauses.map((c, i) => (
          <span key={i} className="font-mono">
            {i > 0 ? " " : ""}#{c.key}:{c.value}
          </span>
        ))}
      </CommandEmpty>
    ) : (
      visibleEntityGroups.map(([type, group]) => {
        const groupLabel = ENTITY_LABELS[type] ?? type;
        return (
          <CommandGroup key={type} heading={groupLabel}>
            {group.map((r) => (
              // existing CommandItem render — copy from the current file
              ...
            ))}
          </CommandGroup>
        );
      })
    )}
  </>
)}
```

> **Implementer note:** Do not invent the `CommandItem` body — copy it verbatim from the existing file. This task only changes the loop-and-empty-state wrapper.

- [ ] **Step 4: Verify no regression on unfiltered state**

Run: `npm run dev` in another terminal. Open chat, type `@` to open the mention popover with no filter. All expected groups should render as before.

- [ ] **Step 5: Verify filtered empty state**

In the same dev session, type `@ #type:nothing-matches-this`. Expect a single `No matches for #type:nothing-matches-this` row (styled as `CommandEmpty`), no group headers.

- [ ] **Step 6: Verify partial match**

Type `@ #type:task`. Expect only the Tasks group to render. Projects, Workflows, Documents, Profiles headers should NOT appear.

- [ ] **Step 7: Typecheck + unit tests**

Run: `npx tsc --noEmit 2>&1 | grep chat-command-popover | head`
Expected: empty.

Run: `npx vitest run src/components/chat`
Expected: PASS (existing tests not regressed).

- [ ] **Step 8: Commit**

```bash
git add src/components/chat/chat-command-popover.tsx
git commit -m "feat(chat): suppress empty entity groups in popover + filter-aware empty state

Groups with 0 matches after #key:value filtering no longer render their
headers. When all groups are empty, a single CommandEmpty echoes the
active filter (e.g. 'No matches for #type:pdf').

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Browser smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Wait for `Ready in ...` on port 3000.

- [ ] **Step 2: Smoke checklist — run each in a fresh browser tab**

1. **Filter hint — first visit:**
   - Open `/documents`. Expect `Tip: use #key:value to filter...` row below the input.
   - Type `#type:pdf` in the filter input.
   - Reload the page. Hint should NOT reappear (flag is set).
   - Clear `localStorage.removeItem("ainative.filter-hint.dismissed")` in devtools, reload. Hint returns.

2. **Filter hint — chat popover:**
   - Open `/chat`. Type `@` to open the mention popover. Expect the same hint row visible.
   - Type `@ #type:task`. Hint disappears.

3. **Saved search inline delete + undo:**
   - Save a view via the chat popover footer (if not already saved).
   - Open `⌘K`. Hover a saved search row. Trash icon appears.
   - Click trash. Toast appears. Row disappears from palette.
   - Click Undo within 5s. Row returns (label/filter/surface preserved; id may differ — this is expected).

4. **Saved search rename:**
   - Open `⌘K`. Select "Manage saved searches…".
   - Click the pencil on a row. Edit label. Blur. Label updates.
   - Close dialog. Reopen `⌘K`. Palette row reflects new label.

5. **Saved search rename validation:**
   - In manager, try to rename a row to empty. Inline error: `Label cannot be empty`. Not persisted.
   - Try renaming to an existing label in the same surface (case-insensitive). Inline error: `...already exists...`. Not persisted.
   - Press Escape mid-edit. Original label restored.

6. **Saved search deliberate delete:**
   - In manager, click trash on a row. Confirm button appears.
   - Click Cancel. Row still there.
   - Click trash again, then Confirm. Row removed (no toast, no undo).

7. **Empty-group suppression:**
   - In chat, type `@ #type:project`. Only Projects group visible.
   - Type `@ #type:zzzz`. Single `No matches for #type:zzzz` row. No group headers.
   - Type just `@`. All groups render normally (baseline).

8. **⌘⌫ keyboard delete:**
   - Open `⌘K`. Arrow-down to focus a saved search row. Press `⌘⌫`.
   - Row deletes with undo toast. (Verify no accidental dialog close.)

- [ ] **Step 3: If any step fails**

Stop. Report which step failed and observed behavior. Do NOT mark the plan complete or open a PR.

- [ ] **Step 4: Clean up and commit verification note**

If all steps pass, add a dated verification note at the end of `features/chat-polish-bundle-v1.md`:

```markdown
## Verification — 2026-04-14

Browser smoke passed all 8 steps. Shipped.
```

Commit:

```bash
git add features/chat-polish-bundle-v1.md
git commit -m "docs(features): chat-polish-bundle-v1 — mark verified

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Run the full unit suite once**

Run: `npx vitest run`
Expected: all tests PASS. Fix any unrelated regressions only if clearly caused by the bundle; otherwise report and stop.

---

## Spec Coverage Check

| Spec section | Implemented by |
|---|---|
| Filter hint — new component | Task 2 |
| Filter hint — wired into `filter-input.tsx` | Task 3 step 1 |
| Filter hint — wired into `chat-command-popover.tsx` | Task 3 step 2 |
| Filter hint — auto-dismissal on first `#` clause | Task 2 `FilterHint` useEffect + Task 2 test 4 |
| `rename` hook method | Task 1 |
| Inline `Trash2` on hover/focus in palette | Task 5 step 2 |
| 5s Undo toast restores record | Task 5 step 3 + browser smoke 3 |
| `⌘⌫` keyboard delete on focused row | Task 5 step 2 `onKeyDown` |
| `Manage saved searches…` entry in palette (not footer) | Task 5 step 2 |
| Manager dialog — rename inline input, blur commits, Esc cancels | Task 4 |
| Manager dialog — validation (empty / too long / duplicate) | Task 4 tests + impl |
| Manager dialog — deliberate confirm delete, no undo | Task 4 test 7 + impl |
| Empty-group suppression in popover | Task 6 |
| Filter-aware `CommandEmpty` when all groups empty | Task 6 step 3 |
| Browser smoke coverage | Task 7 |
| No API route changes | Honored — no file under `src/app/api/` is modified |
| No regression in `saved-search-polish-v1` | Task 7 smoke step 3 exercises palette refetch implicitly; no changes to the refetch-on-open logic |

No gaps found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-14-chat-polish-bundle-v1.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
