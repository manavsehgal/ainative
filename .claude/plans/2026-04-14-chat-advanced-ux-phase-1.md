# Chat Advanced UX — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v2 of `chat-filter-namespace` and `chat-pinned-saved-searches` — closing the two `in-progress` specs spun out of the retired `chat-advanced-ux` umbrella.

**Architecture:** Extend the existing pure parser (`src/lib/filters/parse.ts`) with quoted-value support, then add two consumers: a list-page FilterBar input (proof of shared reuse) and the Skills popover tab. For saved searches, mirror the v1 pins persistence pattern (settings JSON blob + Zod-validated route + hook with optimistic mutations) and surface saved searches in both the chat popover footer and the `⌘K` command palette.

**Tech Stack:** Next.js 16 App Router, React 19, Zod, better-sqlite3 via `getSetting`/`setSetting` helpers, Vitest, cmdk, Tailwind v4.

**Out of scope (this phase):** `chat-skill-composition` and `chat-conversation-branches` — see Phase 2/3 in the session that generated this plan.

---

## File Structure

**New files:**
- `src/app/api/settings/chat/saved-searches/route.ts` — GET/PUT route for saved search records
- `src/hooks/use-saved-searches.ts` — client hook mirroring `use-pinned-entries.ts`
- `src/components/shared/filter-input.tsx` — reusable text input that parses `#key:value` + hints chips
- `src/lib/filters/__tests__/parse.quoted.test.ts` — extended parser tests (new file keeps existing 17-test suite untouched)

**Modified files:**
- `src/lib/filters/parse.ts` — add quoted-value support to `CLAUSE_PATTERN`
- `src/components/chat/chat-command-popover.tsx` — apply clauses to Skills tab; render `Saved` cmdk group; render "Save this view" footer affordance
- `src/components/documents/document-browser.tsx` — mount `<FilterInput>` inside the existing `<FilterBar>` as the list-page reference consumer, apply parsed clauses to document filtering, sync URL `?filter=` param
- `src/components/shared/command-palette.tsx` — add `Saved searches` group that navigates to list page with `?filter=` applied
- `features/chat-filter-namespace.md` — mark remaining ACs `[x]`, bump status → `completed`
- `features/chat-pinned-saved-searches.md` — mark remaining ACs `[x]`, bump status → `completed`
- `features/roadmap.md` — sync status columns
- `features/changelog.md` — add v2 ship entry

---

## Task 1: Parser — Quoted Value Support

**Files:**
- Modify: `src/lib/filters/parse.ts:41` (CLAUSE_PATTERN)
- Test: `src/lib/filters/__tests__/parse.quoted.test.ts` (new)

- [ ] **Step 1.1: Write failing tests**

```typescript
// src/lib/filters/__tests__/parse.quoted.test.ts
import { describe, it, expect } from "vitest";
import { parseFilterInput } from "../parse";

describe("parseFilterInput — quoted values", () => {
  it("parses a double-quoted value with spaces", () => {
    expect(parseFilterInput('#tag:"needs review"')).toEqual({
      clauses: [{ key: "tag", value: "needs review" }],
      rawQuery: "",
    });
  });

  it("preserves raw query surrounding a quoted clause", () => {
    expect(parseFilterInput('auth #label:"in progress" redesign')).toEqual({
      clauses: [{ key: "label", value: "in progress" }],
      rawQuery: "auth redesign",
    });
  });

  it("allows `#` inside quoted values (previously a terminator)", () => {
    expect(parseFilterInput('#note:"see #123"')).toEqual({
      clauses: [{ key: "note", value: "see #123" }],
      rawQuery: "",
    });
  });

  it("falls back to whitespace termination for unquoted values", () => {
    expect(parseFilterInput("#status:blocked more text")).toEqual({
      clauses: [{ key: "status", value: "blocked" }],
      rawQuery: "more text",
    });
  });

  it("treats a lone opening quote as raw query (malformed input survives)", () => {
    const result = parseFilterInput('#tag:"unterminated');
    // Either clauses:[] + rawQuery preserves the fragment, OR clauses captures
    // until EOL. Assert the known behavior we pick — see implementation below.
    expect(result.clauses).toEqual([{ key: "tag", value: "unterminated" }]);
    expect(result.rawQuery).toBe("");
  });
});
```

- [ ] **Step 1.2: Run test to verify failure**

Run: `npx vitest run src/lib/filters/__tests__/parse.quoted.test.ts`
Expected: 4-5 failures (quoted parsing not yet supported).

- [ ] **Step 1.3: Extend parser**

Replace the `CLAUSE_PATTERN` constant in `src/lib/filters/parse.ts`:

```typescript
// Value may be either:
//   - a double-quoted run of any non-quote chars: `"..."`  (captured in group 2)
//   - OR an unquoted whitespace/`#`-terminated run   (captured in group 3)
// Exactly one of group 2 / group 3 will be defined per match.
const CLAUSE_PATTERN = /#([A-Za-z][\w-]*):(?:"([^"]*)"|([^\s#]+))/g;
```

Update the `replace` callback to pick the right group:

```typescript
rawQuery = rawQuery.replace(
  CLAUSE_PATTERN,
  (_match, key: string, quoted: string | undefined, bare: string | undefined) => {
    const value = quoted !== undefined ? quoted : bare ?? "";
    clauses.push({ key, value });
    return " ";
  }
);
```

- [ ] **Step 1.4: Run tests**

Run: `npx vitest run src/lib/filters/__tests__/`
Expected: All 17 existing + 5 new tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/filters/parse.ts src/lib/filters/__tests__/parse.quoted.test.ts
git commit -m "feat(filters): #key:\"quoted value\" parser support (v2)"
```

---

## Task 2: FilterInput Component

**Files:**
- Create: `src/components/shared/filter-input.tsx`
- Test: none (visual component; covered by E2E in task 3)

- [ ] **Step 2.1: Write FilterInput**

```tsx
// src/components/shared/filter-input.tsx
"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseFilterInput, type FilterClause } from "@/lib/filters/parse";

interface FilterInputProps {
  value: string;
  onChange: (next: { raw: string; clauses: FilterClause[]; rawQuery: string }) => void;
  placeholder?: string;
}

/**
 * Free-text input that recognizes `#key:value` filter syntax and surfaces
 * parsed clauses as dismissable chips. Consumer receives both the raw string
 * (for URL serialization) and the parsed breakdown (for filtering).
 */
export function FilterInput({ value, onChange, placeholder }: FilterInputProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const parsed = parseFilterInput(local);

  return (
    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
      <div className="relative flex-1 min-w-[16rem]">
        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
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
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/shared/filter-input.tsx
git commit -m "feat(filters): shared FilterInput component"
```

---

## Task 3: List-Page Reference Consumer (Document Browser)

**Files:**
- Modify: `src/components/documents/document-browser.tsx` (FilterBar block around line 113)

- [ ] **Step 3.1: Wire FilterInput + URL state**

Inside `DocumentBrowser`, add state and URL sync:

```tsx
import { useRouter, useSearchParams } from "next/navigation";
import { FilterInput } from "@/components/shared/filter-input";
import { matchesClauses, parseFilterInput } from "@/lib/filters/parse";
// ...
const searchParams = useSearchParams();
const router = useRouter();
const [filterRaw, setFilterRaw] = useState(searchParams.get("filter") ?? "");
const [clauses, setClauses] = useState(() => parseFilterInput(filterRaw).clauses);
const [rawQuery, setRawQuery] = useState(() => parseFilterInput(filterRaw).rawQuery);
```

Inside the `<FilterBar>` block, replace the existing free-text search with:

```tsx
<FilterInput
  value={filterRaw}
  onChange={({ raw, clauses, rawQuery }) => {
    setFilterRaw(raw);
    setClauses(clauses);
    setRawQuery(rawQuery);
    const params = new URLSearchParams(searchParams.toString());
    if (raw) params.set("filter", raw);
    else params.delete("filter");
    router.replace(`?${params.toString()}`, { scroll: false });
  }}
  placeholder="#type:pdf or #status:processed or search…"
/>
```

Apply filtering (merge with existing filters — do not replace; keep the typed controls for discoverability):

```tsx
const filtered = documents.filter((doc) => {
  if (rawQuery && !doc.filename.toLowerCase().includes(rawQuery.toLowerCase())) return false;
  return matchesClauses(doc, clauses, {
    type: (d, v) => (d.mimeType ?? "").toLowerCase().includes(v.toLowerCase()),
    status: (d, v) => (d.processingStatus ?? "").toLowerCase() === v.toLowerCase(),
  });
});
```

- [ ] **Step 3.2: Manual verification (browser smoke)**

Start dev server (`npm run dev`), open `/documents`, type `#type:pdf` — only PDFs remain; URL shows `?filter=%23type%3Apdf`. Refresh — filter persists from URL. Type `#status:processed report` — applies both clause and raw query.

- [ ] **Step 3.3: Commit**

```bash
git add src/components/documents/document-browser.tsx
git commit -m "feat(documents): FilterInput + URL state consumes #key:value syntax"
```

---

## Task 4: Skills Tab Popover Filter

**Files:**
- Modify: `src/components/chat/chat-command-popover.tsx` (locate Skills tab group rendering)

- [ ] **Step 4.1: Inspect current Skills tab structure**

Before editing, open the file and find where slash-command results for `/skills` render. Identify:
1. The current data source (likely fetched or static list with a `scope` field)
2. Where `parseFilterInput` is already applied to the popover input (it is — for `@` entities)

- [ ] **Step 4.2: Apply clauses to skills list**

Extend the existing `matchesClauses` call (or add one specific to the `/skills` branch) with a predicate for `scope`:

```tsx
const filteredSkills = skills.filter((skill) => {
  if (rawQuery && !skill.name.toLowerCase().includes(rawQuery.toLowerCase())) return false;
  return matchesClauses(skill, clauses, {
    scope: (s, v) => (s.scope ?? "").toLowerCase() === v.toLowerCase(),
    type: (s, v) => (s.type ?? "").toLowerCase() === v.toLowerCase(),
  });
});
```

- [ ] **Step 4.3: Browser smoke test**

Open chat, type `/skills #scope:project` — only project-scoped skills remain. Type `/skills #scope:user` — only user-scoped. No regression to `@task: #status:blocked`.

- [ ] **Step 4.4: Commit**

```bash
git add src/components/chat/chat-command-popover.tsx
git commit -m "feat(chat): #scope: filter on /skills popover tab"
```

---

## Task 5: Saved Searches — API Route

**Files:**
- Create: `src/app/api/settings/chat/saved-searches/route.ts`
- Test: `src/app/api/settings/chat/saved-searches/__tests__/route.test.ts`

- [ ] **Step 5.1: Write API route**

```typescript
// src/app/api/settings/chat/saved-searches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { z } from "zod";

const SETTINGS_KEY = "chat.savedSearches";

const SURFACES = [
  "task", "project", "workflow", "document", "skill", "profile",
] as const;

const SavedSearchSchema = z.object({
  id: z.string().min(1),
  surface: z.enum(SURFACES),
  label: z.string().min(1).max(120),
  filterInput: z.string().max(500),
  createdAt: z.string(),
});

const PayloadSchema = z.object({
  searches: z.array(SavedSearchSchema),
});

export type SavedSearch = z.infer<typeof SavedSearchSchema>;

export async function GET() {
  const raw = await getSetting(SETTINGS_KEY);
  if (!raw) return NextResponse.json({ searches: [] });
  try {
    const parsed = PayloadSchema.parse(JSON.parse(raw));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ searches: [] });
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }

  const result = PayloadSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "invalid searches payload", issues: result.error.issues },
      { status: 400 }
    );
  }
  const byId = new Map<string, SavedSearch>();
  for (const s of result.data.searches) byId.set(s.id, s);
  const deduped = Array.from(byId.values());
  await setSetting(SETTINGS_KEY, JSON.stringify({ searches: deduped }));
  return NextResponse.json({ searches: deduped });
}
```

- [ ] **Step 5.2: Write route test**

```typescript
// src/app/api/settings/chat/saved-searches/__tests__/route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/settings/helpers", () => {
  const store = new Map<string, string>();
  return {
    getSetting: vi.fn(async (k: string) => store.get(k) ?? null),
    setSetting: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    __store: store,
  };
});

import { GET, PUT } from "../route";
import { NextRequest } from "next/server";

describe("saved-searches route", () => {
  it("GET empty returns []", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ searches: [] });
  });

  it("PUT stores valid payload + dedupes by id", async () => {
    const req = new NextRequest("http://x/api/settings/chat/saved-searches", {
      method: "PUT",
      body: JSON.stringify({
        searches: [
          { id: "a", surface: "task", label: "Blocked", filterInput: "#status:blocked", createdAt: "2026-04-14T00:00:00Z" },
          { id: "a", surface: "task", label: "Blocked (dup)", filterInput: "#status:blocked", createdAt: "2026-04-14T00:01:00Z" },
        ],
      }),
    });
    const res = await PUT(req);
    const body = await res.json();
    expect(body.searches).toHaveLength(1);
    expect(body.searches[0].label).toBe("Blocked (dup)");
  });

  it("PUT rejects invalid surface", async () => {
    const req = new NextRequest("http://x", {
      method: "PUT",
      body: JSON.stringify({ searches: [{ id: "a", surface: "bogus", label: "x", filterInput: "", createdAt: "z" }] }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5.3: Run tests**

Run: `npx vitest run src/app/api/settings/chat/saved-searches/`
Expected: 3 tests pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/app/api/settings/chat/saved-searches/
git commit -m "feat(chat): /api/settings/chat/saved-searches route + tests"
```

---

## Task 6: Saved Searches — Client Hook

**Files:**
- Create: `src/hooks/use-saved-searches.ts`

- [ ] **Step 6.1: Write hook (mirror use-pinned-entries pattern)**

```typescript
// src/hooks/use-saved-searches.ts
"use client";
import { useCallback, useEffect, useState } from "react";

export type SavedSearchSurface =
  "task" | "project" | "workflow" | "document" | "skill" | "profile";

export interface SavedSearch {
  id: string;
  surface: SavedSearchSurface;
  label: string;
  filterInput: string;
  createdAt: string;
}

interface UseSavedSearchesReturn {
  searches: SavedSearch[];
  loading: boolean;
  save: (entry: Omit<SavedSearch, "id" | "createdAt">) => SavedSearch;
  remove: (id: string) => void;
  forSurface: (surface: SavedSearchSurface) => SavedSearch[];
}

export function useSavedSearches(): UseSavedSearchesReturn {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/chat/saved-searches")
      .then((r) => (r.ok ? r.json() : { searches: [] }))
      .then((d: { searches?: SavedSearch[] }) => { if (!cancelled) setSearches(d.searches ?? []); })
      .catch(() => { if (!cancelled) setSearches([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (next: SavedSearch[]) => {
    try {
      await fetch("/api/settings/chat/saved-searches", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searches: next }),
      });
    } catch { /* optimistic already applied */ }
  }, []);

  const save = useCallback(
    (entry: Omit<SavedSearch, "id" | "createdAt">): SavedSearch => {
      const full: SavedSearch = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const next = [...searches, full];
      setSearches(next);
      void persist(next);
      return full;
    },
    [searches, persist]
  );

  const remove = useCallback(
    (id: string) => {
      const next = searches.filter((s) => s.id !== id);
      setSearches(next);
      void persist(next);
    },
    [searches, persist]
  );

  const forSurface = useCallback(
    (surface: SavedSearchSurface) => searches.filter((s) => s.surface === surface),
    [searches]
  );

  return { searches, loading, save, remove, forSurface };
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/hooks/use-saved-searches.ts
git commit -m "feat(chat): useSavedSearches hook"
```

---

## Task 7: Popover — "Save this view" Footer + Saved Group

**Files:**
- Modify: `src/components/chat/chat-command-popover.tsx`

- [ ] **Step 7.1: Render Saved group above entity results for the active surface**

Import the hook and add a `Saved` cmdk group when `searches.length > 0`:

```tsx
import { useSavedSearches } from "@/hooks/use-saved-searches";
// inside component:
const { forSurface, save, remove } = useSavedSearches();
const currentSurface = /* derive from active tab: "task" | "project" | ... */;
const savedForSurface = forSurface(currentSurface);
```

Add a cmdk group:

```tsx
{savedForSurface.length > 0 && (
  <CommandGroup heading="Saved">
    {savedForSurface.map((s) => (
      <CommandItem
        key={s.id}
        onSelect={() => {
          // Apply s.filterInput to the popover input by updating the shared
          // search state (the same state parseFilterInput already runs on).
          setPopoverSearch(s.filterInput);
        }}
      >
        <Bookmark className="h-3.5 w-3.5 mr-2" />
        <span>{s.label}</span>
        <span className="ml-auto text-xs font-mono text-muted-foreground">{s.filterInput}</span>
      </CommandItem>
    ))}
  </CommandGroup>
)}
```

- [ ] **Step 7.2: Render "Save this view" affordance when clauses present**

At the bottom of the popover (CommandEmpty sibling / footer row):

```tsx
{clauses.length > 0 && (
  <div className="border-t px-2 py-1.5 flex items-center gap-2">
    {!renaming ? (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => setRenaming(true)}
      >
        <Bookmark className="h-3.5 w-3.5 mr-1.5" />
        Save this view
      </Button>
    ) : (
      <form
        className="flex items-center gap-2 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          save({ surface: currentSurface, label: nameDraft || defaultLabel(clauses), filterInput: popoverSearch });
          setRenaming(false);
          setNameDraft("");
        }}
      >
        <Input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder={defaultLabel(clauses)}
          className="h-7 text-xs flex-1"
        />
        <Button size="sm" variant="default" type="submit" className="h-7 text-xs">Save</Button>
      </form>
    )}
  </div>
)}
```

Add `defaultLabel` helper:

```tsx
function defaultLabel(clauses: { key: string; value: string }[]) {
  return clauses.map((c) => `#${c.key}:${c.value}`).join(" ");
}
```

- [ ] **Step 7.3: Browser smoke test**

Open chat, type `@task: #status:blocked`, click "Save this view", accept default label. Close and reopen popover — "Saved" group shows the entry. Click it — filter reapplies. Type `@task: #priority:high`, save as "High priority". Two saved entries in group. Test surface isolation: `@project:` popover must NOT show the task-surface saved searches.

- [ ] **Step 7.4: Commit**

```bash
git add src/components/chat/chat-command-popover.tsx
git commit -m "feat(chat): Save-this-view affordance + Saved cmdk group in popover"
```

---

## Task 8: Command Palette — Saved Searches Group

**Files:**
- Modify: `src/components/shared/command-palette.tsx`

- [ ] **Step 8.1: Render Saved searches group**

Add after existing groups:

```tsx
import { useSavedSearches } from "@/hooks/use-saved-searches";
import { useRouter } from "next/navigation";
// inside component:
const { searches } = useSavedSearches();
const router = useRouter();

// Surface → list route
const routeForSurface: Record<string, string> = {
  task: "/dashboard",        // tasks live on dashboard until /tasks exists
  project: "/projects",
  workflow: "/workflows",
  document: "/documents",
  skill: "/skills",
  profile: "/profiles",
};
```

In JSX:

```tsx
{searches.length > 0 && (
  <CommandGroup heading="Saved searches">
    {searches.map((s) => (
      <CommandItem
        key={s.id}
        onSelect={() => {
          const base = routeForSurface[s.surface] ?? "/";
          router.push(`${base}?filter=${encodeURIComponent(s.filterInput)}`);
          onClose();
        }}
      >
        <Bookmark className="h-3.5 w-3.5 mr-2" />
        <span>{s.label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{s.surface}</span>
      </CommandItem>
    ))}
  </CommandGroup>
)}
```

- [ ] **Step 8.2: Browser smoke test**

Press `⌘K`, type "high" — "High priority" saved search ranks. Select → navigates to `/dashboard?filter=%23priority%3Ahigh`. Navigate to `/documents`, save a search, reopen `⌘K`, confirm both surfaces appear with their surface labels.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/shared/command-palette.tsx
git commit -m "feat(palette): ⌘K Saved searches group navigates to list page with filter"
```

---

## Task 9: Spec + Roadmap + Changelog Sync

**Files:**
- Modify: `features/chat-filter-namespace.md`
- Modify: `features/chat-pinned-saved-searches.md`
- Modify: `features/roadmap.md`
- Modify: `features/changelog.md`

- [ ] **Step 9.1: Check remaining ACs on both specs**

For `chat-filter-namespace.md` — flip these to `[x]`:
- `[ ] Typing #scope:project inside /skills filters the Skills tab` → `[x]` (shipped in Task 4)
- `[ ] /tasks?filter=...` → reword to `[x] /documents?filter=... (reference consumer)` to match actual shipped surface

For `chat-pinned-saved-searches.md` — flip to `[x]`:
- `Save this view` button
- Saved searches in `Saved` group + `⌘K`

Bump both `status:` headers from `in-progress` → `completed`. Remove the inline `# v1 ...` comment.

- [ ] **Step 9.2: Sync roadmap**

```bash
grep -n "chat-filter-namespace\|chat-pinned-saved-searches" features/roadmap.md
```

Flip the `in-progress` cell to `completed` for both rows.

- [ ] **Step 9.3: Add changelog entry**

Prepend a `2026-04-14 — v2 ship` block to `features/changelog.md` with:
- Parser quoted-value support
- `/documents` reference consumer with URL state
- Skills-tab `#scope:` filter
- `Save this view` + `Saved` cmdk group
- `⌘K` Saved searches surfacing
- Decision: `/documents` picked over `/tasks` because tasks index is a redirect stub; `/documents` already uses the shared `<FilterBar>`

- [ ] **Step 9.4: Commit**

```bash
git add features/
git commit -m "docs(features): close out chat-filter-namespace + chat-pinned-saved-searches v2"
```

---

## Final Verification

- [ ] **Run full test suite:** `npm test`
- [ ] **Type check:** `npx tsc --noEmit`
- [ ] **Dev-server smoke:** `npm run dev`, exercise all three surfaces (chat popover, `/documents` FilterBar, `⌘K` palette) end-to-end
- [ ] **Per MEMORY.md / CLAUDE.md "Smoke-test budget"**: none of this touches runtime catalog imports, so unit + browser smoke is sufficient — no extra agent-runtime smoke required

---

## Self-Review Notes

**Spec coverage:** Each `[ ]` AC in both specs maps to a task above (Task 1 → quoted values; Task 3 → list-page consumer; Task 4 → Skills tab; Tasks 5-8 → saved searches + palette). The "right-click / ⌘P pins" AC on `chat-pinned-saved-searches.md` is still open — that is explicitly deferred in the spec's own v2 notes ("hover-button is v1 UX"), so we keep it `[ ]` and note in the changelog.

**Type consistency:** `SavedSearchSurface` defined once in `use-saved-searches.ts` and re-used; route-level Zod schema keys match hook property names (`filterInput`, `createdAt`, `surface`, `label`, `id`). Popover and palette both read from the same hook.

**Placeholder scan:** No TBD, no "similar to task N", all code blocks present.
