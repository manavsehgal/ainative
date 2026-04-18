# Sidebar IA + Route Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the sidebar from 4 groups to 5 (Home / Compose / Observe / Learn / Configure), promote Profiles + Schedules into Compose, reclaim the "Dashboard" label for the `/` overview, and rename the kanban route from `/dashboard` to `/tasks`.

**Architecture:** Single-layer frontend + routing change. No DB, runtime, or workflow coupling. The kanban body moves wholesale from `src/app/dashboard/page.tsx` to `src/app/tasks/page.tsx`; the `/dashboard/` directory is deleted outright (alpha audience, no back-compat redirect). Sidebar adopts a 5-accordion layout with 2-line menu items (title + subtext ≤32 chars per DD-020). A new TDR codifies the object-label route convention to prevent regression.

**Tech Stack:** Next.js 16 (Turbopack) App Router, React 19, Tailwind v4, TypeScript, better-sqlite3 + Drizzle. No new libraries.

---

## Source Specification

Feature spec: `features/sidebar-ia-route-restructure.md` (257 lines, implementation-ready).
Architect blast radius report: `features/architect-report.md` (MEDIUM, ~50 files, single layer).

## NOT in Scope

| Deferred item | Rationale |
|---|---|
| Brand rename assets (logo, wordmark, favicon) | Tracked under the brand-pivot work item, not this plan |
| Back-compat redirect `/dashboard` → `/tasks` | Product decision 2026-04-18: alpha audience, clean delete preferred over 1-line stub |
| `g d` legacy keybinding preservation | Removed outright per product decision |
| Changes to `/` overview content (greeting, cards, priority queue logic) | Route stays, layout stays; only the sidebar pointer changes |
| Changes to kanban internals (view toggle, filters, density, detail sheet) | Component body moves intact |
| Doc/screengrab/book regeneration | Handoff to `/refresh-content-pipeline` bundled with brand pivot — this plan flags the handoff, does not execute the cascade |
| New items in Learn or Configure groups | No requirement emerged |
| A 6th group or further IA splits | Out of scope |
| Adding a slow-DB skeleton for `/` | Deferred; no current regression |

## What Already Exists (Reuse Targets)

| Artifact | Location | Reuse role |
|---|---|---|
| `HomePage` Server Component | `src/app/page.tsx` | Unchanged. Becomes the Dashboard nav target. |
| Kanban page body | `src/app/dashboard/page.tsx` | Moves verbatim to `src/app/tasks/page.tsx` |
| `WelcomeLanding` | `src/components/dashboard/welcome-landing.tsx` | Empty-state for `/` — no change |
| `ActivationChecklist` | `src/components/onboarding/activation-checklist.tsx` | Empty-state for `/` — no change |
| `SkeletonBoard` | `src/components/tasks/skeleton-board.tsx` | Suspense fallback for `/tasks` — moves with the page body |
| `TaskSurface` | `src/components/tasks/task-surface.tsx` | Only edit is H1 text (line 64) |
| `KanbanBoard` / `TaskTableView` / `TaskViewToggle` / `DensityToggle` | `src/components/tasks/` | Used by TaskSurface — untouched |
| `AppSidebar` accordion infra | `src/components/shared/app-sidebar.tsx` | `NavGroup`, `toggleGroup`, `isItemActive` all stay; edits are data + group split |
| `isItemActive` root guard | `src/components/shared/app-sidebar.tsx:98` | Already correct for the new `Dashboard → "/"` entry — zero logic change |
| TDR directory + frontmatter template | `.claude/skills/architect/references/tdr-*.md` | Pattern for TDR-033 |
| Sidebar tests baseline | (none for the sidebar component itself today) | Smoke test is the primary verification |

## Files Touched

### Created
- `.claude/skills/architect/references/tdr-033-route-object-label-convention.md`
- `src/app/tasks/page.tsx` — **overwrites** the existing 3-line redirect stub with the kanban body

### Modified
- `src/components/shared/app-sidebar.tsx` — 4-group → 5-group, add Tasks item, rename Manage → Observe, promote Profiles + Schedules, update Dashboard href
- `src/components/shared/global-shortcuts.tsx` — remove `g d`, add `g h` + `g t`
- `src/components/shared/command-palette.tsx` — entity alias `task: "/dashboard"` → `"/tasks"`
- `src/lib/chat/command-data.ts` — palette "Dashboard" entry → split into Dashboard (`/`) and Tasks (`/tasks`); update keywords
- `src/lib/chat/entity-detector.ts` — 2 href literals at `:124` and `:147`
- `src/components/chat/chat-quick-access.tsx` — special-case check at `:35`
- `src/components/tasks/task-surface.tsx` — H1 text at `:64`
- `src/app/tasks/[id]/page.tsx` — `backHref` at `:53`, label at `:53`
- `src/app/tasks/new/page.tsx` — `backHref` at `:20`, label at `:20`
- `src/components/dashboard/stats-cards.tsx` — `Link href` at `:52`
- `src/components/dashboard/priority-queue.tsx` — `Link href` at `:119`
- `src/components/tasks/task-create-panel.tsx` — `router.push` at `:207` and `:523`
- `src/components/tasks/task-detail-view.tsx` — `router.push` at `:56`
- `src/components/workflows/workflow-confirmation-view.tsx` — `router.push` at `:213`
- `src/components/costs/cost-dashboard.tsx` — deeplink at `:755`
- `src/components/notifications/__tests__/pending-approval-host.test.tsx` — `usePathname` mock at `:13`
- `src/app/api/workflows/from-assist/route.ts` — line 69 comment (cosmetic)

### Deleted
- `src/app/dashboard/` (directory) — page.tsx + `__tests__/accessibility.test.tsx`. The accessibility test is scoped to dashboard components, not the route; relocate it if still relevant, otherwise remove with the directory.

### Unchanged (but verify)
- `src/app/page.tsx` — HomePage body stays; only the sidebar link now points at it
- `src/components/dashboard/*` — all dashboard subcomponents untouched
- `src/components/tasks/kanban-board.tsx` and siblings — untouched

---

## Task 1: Write TDR-033

**Files:**
- Create: `.claude/skills/architect/references/tdr-033-route-object-label-convention.md`

- [ ] **Step 1: Write the TDR file**

```markdown
---
id: TDR-033
title: Route Semantics — Object-Label Convention for List Routes
status: accepted
date: 2026-04-18
category: frontend-architecture
---

# TDR-033: Route Semantics — Object-Label Convention for List Routes

## Context

The App Router layout at `src/app/` grew one list route at a time as features shipped: `/projects`, `/workflows`, `/profiles`, `/schedules`, `/documents`, `/tables`. Every one followed the same implicit rule — the route is named after the object it lists, in plural form. One route violated this rule: `/dashboard`, which hosted the kanban task board. The route was named after a view type, not the object, and the corresponding object route `/tasks` existed only as a redirect stub. This inconsistency confused the sidebar IA (the real dashboard at `/` had no nav entry) and left future contributors with no written rule to reference.

## Decision

List routes name the object, not the view type:

- **List routes**: plural object name. `/tasks`, `/projects`, `/workflows`, `/profiles`, `/schedules`, `/documents`, `/tables`.
- **Detail routes**: object singular + id. `/tasks/[id]`, `/projects/[id]`.
- **Create routes**: `/<object>/new` where applicable. `/tasks/new`.
- **Root `/`**: reserved for the cross-cutting home overview (Dashboard).
- **View-type selection** (board vs. table vs. grid vs. kanban): an in-page toggle via `TaskViewToggle` or equivalent — never a separate route.

Routes named after view types (`/dashboard`, `/kanban`, `/board`, `/grid`) are prohibited. If a future feature introduces a new list surface, the route follows this convention from day one.

## Consequences

- **Easier:** Naming new routes requires zero deliberation — the object name is the route name.
- **Easier:** Cross-referencing a route in docs and chat tools is predictable (`@task` entity → `/tasks`, `@project` → `/projects`).
- **Harder:** Any future desire to promote a specific view (e.g. "Timeline") to a route must go through a TDR update — single-route convention resists drift.
- **Historical cost paid once:** `/dashboard` was renamed to `/tasks` in the sidebar-ia-route-restructure feature (2026-04-18). No back-compat redirect was preserved (alpha audience).

## Alternatives Considered

- **"View-type routes are OK if the view is canonical"** — rejected. Leads to drift where every new view gets a route, blowing up the sitemap.
- **"Keep `/dashboard` as an alias to `/tasks`"** — rejected. Two URLs for one page doubles the maintenance surface with no user benefit for an alpha product.
- **"Use `/tasks/board` and `/tasks/table` for views"** — rejected. Flips the mental model from object-first to view-first and breaks the sibling pattern across other list routes.

## References

- `features/sidebar-ia-route-restructure.md` — the feature that enforced this convention
- `features/architect-report.md` — blast-radius analysis including the `isItemActive` root-path guard correctness check
- `src/components/shared/app-sidebar.tsx` — NavItem registry now follows this convention for all list routes
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/architect/references/tdr-033-route-object-label-convention.md
git commit -m "docs(architect): TDR-033 object-label convention for list routes"
```

---

## Task 2: Move Kanban Body From `/dashboard` to `/tasks`

**Files:**
- Modify (overwrite): `src/app/tasks/page.tsx`
- Delete: `src/app/dashboard/page.tsx`, `src/app/dashboard/__tests__/accessibility.test.tsx` (entire directory)

- [ ] **Step 1: Copy the dashboard page body into tasks/page.tsx**

Read `src/app/dashboard/page.tsx` and replace the current 3-line redirect stub at `src/app/tasks/page.tsx` with the full page body. Preserve every import, query, `<Suspense>` boundary, and component. Only change the file location.

Verification command:

```bash
diff <(cat src/app/dashboard/page.tsx) <(cat src/app/tasks/page.tsx)
```

Expected: zero diff after the overwrite (they should be byte-identical).

- [ ] **Step 2: Relocate or remove the accessibility test**

Check `src/app/dashboard/__tests__/accessibility.test.tsx` — if it tests the page component directly, move its target to match the new path. If it tests sub-components (likely), move the test file to live next to those components (e.g., `src/components/dashboard/__tests__/`) and update import paths.

Run: `rg "from .\\./\\.\\./page" src/app/dashboard/__tests__/`

If the test imports from the page file, update the import to `../../tasks/page`. If it imports from component files only, the move is mechanical.

- [ ] **Step 3: Delete the `/dashboard` directory**

```bash
rm -rf src/app/dashboard
```

- [ ] **Step 4: Verify the redirect stub is gone and `/tasks` has the kanban**

```bash
rg -n "redirect\(.*/dashboard" src/app/tasks/page.tsx
```

Expected: zero matches (the old stub is gone).

```bash
rg -n "KanbanBoard|TaskSurface" src/app/tasks/page.tsx
```

Expected: matches showing the kanban imports.

- [ ] **Step 5: Commit**

```bash
git add src/app/tasks/page.tsx src/app/dashboard
git commit -m "refactor(routes): move kanban from /dashboard to /tasks, delete /dashboard"
```

---

## Task 3: Rename Task-Surface H1 and PageShell backHrefs

**Files:**
- Modify: `src/components/tasks/task-surface.tsx:64`
- Modify: `src/app/tasks/[id]/page.tsx:53`
- Modify: `src/app/tasks/new/page.tsx:20`

- [ ] **Step 1: Rename the kanban H1**

In `src/components/tasks/task-surface.tsx` at line 64:

Before:
```tsx
<h1 className="text-2xl font-bold">Dashboard</h1>
```

After:
```tsx
<h1 className="text-2xl font-bold">Tasks</h1>
```

- [ ] **Step 2: Update task detail backHref + label**

In `src/app/tasks/[id]/page.tsx` at line 53:

Before:
```tsx
<PageShell backHref="/dashboard" backLabel="Back to Dashboard">
```

After:
```tsx
<PageShell backHref="/tasks" backLabel="Back to Tasks">
```

- [ ] **Step 3: Update task new backHref + label**

In `src/app/tasks/new/page.tsx` at line 20:

Before:
```tsx
<PageShell backHref="/dashboard" backLabel="Back to Dashboard">
```

After:
```tsx
<PageShell backHref="/tasks" backLabel="Back to Tasks">
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "task-surface|tasks/\[id\]|tasks/new" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/task-surface.tsx src/app/tasks/\[id\]/page.tsx src/app/tasks/new/page.tsx
git commit -m "refactor(tasks): rename H1 and backHrefs from Dashboard to Tasks"
```

---

## Task 4: Remap Navigation-After Sites (6 Components)

**Files:**
- Modify: `src/components/dashboard/stats-cards.tsx:52`
- Modify: `src/components/dashboard/priority-queue.tsx:119`
- Modify: `src/components/tasks/task-create-panel.tsx:207,523`
- Modify: `src/components/tasks/task-detail-view.tsx:56`
- Modify: `src/components/workflows/workflow-confirmation-view.tsx:213`
- Modify: `src/components/costs/cost-dashboard.tsx:755`

- [ ] **Step 1: Rewrite the 6 literal `/dashboard` targets to `/tasks`**

Each site is a single-line string change. Keep query strings when present (the cost-dashboard deeplink `/dashboard?create=task` becomes `/tasks?create=task`).

Edit `src/components/dashboard/stats-cards.tsx:52`:
Before: `href: "/dashboard",`
After: `href: "/tasks",`

Edit `src/components/dashboard/priority-queue.tsx:119`:
Before: `<Link href="/dashboard">`
After: `<Link href="/tasks">`

Edit `src/components/tasks/task-create-panel.tsx:207`:
Before: `router.push("/dashboard");`
After: `router.push("/tasks");`

Edit `src/components/tasks/task-create-panel.tsx:523`:
Before: `router.push("/dashboard");`
After: `router.push("/tasks");`

Edit `src/components/tasks/task-detail-view.tsx:56`:
Before: `onDeleted: () => router.push("/dashboard"),`
After: `onDeleted: () => router.push("/tasks"),`

Edit `src/components/workflows/workflow-confirmation-view.tsx:213`:
Before: `router.push("/dashboard");`
After: `router.push("/tasks");`

Edit `src/components/costs/cost-dashboard.tsx:755`:
Before: `<Link href="/dashboard?create=task">`
After: `<Link href="/tasks?create=task">`

- [ ] **Step 2: Verify no navigation-after site still points to `/dashboard`**

```bash
rg -n 'router\.push\("/dashboard|Link href="/dashboard' src/components/
```

Expected: zero matches.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "stats-cards|priority-queue|task-create-panel|task-detail-view|workflow-confirmation|cost-dashboard" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard src/components/tasks src/components/workflows src/components/costs
git commit -m "refactor(nav): remap navigation-after sites from /dashboard to /tasks"
```

---

## Task 5: Update Nav Infrastructure (Shortcuts, Palette, Chat Tools, Tests)

**Files:**
- Modify: `src/components/shared/global-shortcuts.tsx:34`
- Modify: `src/components/shared/command-palette.tsx:40`
- Modify: `src/lib/chat/command-data.ts:32`
- Modify: `src/lib/chat/entity-detector.ts:124,147`
- Modify: `src/components/chat/chat-quick-access.tsx:35`
- Modify: `src/components/notifications/__tests__/pending-approval-host.test.tsx:13`

- [ ] **Step 1: Rewrite keyboard shortcuts**

In `src/components/shared/global-shortcuts.tsx`, locate line 34 (the `g d` binding). Replace the single entry with two entries:

Before:
```ts
{ id: "nav-dashboard", keys: "g d", description: "Go to Dashboard", scope: "global", category: "Navigation", handler: () => router.push("/dashboard") },
```

After:
```ts
{ id: "nav-home", keys: "g h", description: "Go to Home", scope: "global", category: "Navigation", handler: () => router.push("/") },
{ id: "nav-tasks", keys: "g t", description: "Go to Tasks", scope: "global", category: "Navigation", handler: () => router.push("/tasks") },
```

- [ ] **Step 2: Update command palette entity alias**

In `src/components/shared/command-palette.tsx` at line 40:

Before:
```ts
task: "/dashboard",
```

After:
```ts
task: "/tasks",
```

- [ ] **Step 3: Update command-data palette entries**

In `src/lib/chat/command-data.ts`, locate line 32:

Before:
```ts
{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "tasks kanban board" },
```

After (split into two entries):
```ts
{ title: "Dashboard", href: "/", icon: LayoutDashboard, keywords: "home overview stats priority" },
{ title: "Tasks", href: "/tasks", icon: Table2, keywords: "tasks kanban board" },
```

Note: the `Table2` icon import may need adding if not already present. Check the top of the file. If unavailable, use any existing icon that's already imported (e.g., `ListTodo` if imported, or fall back to `LayoutDashboard` for both and accept identical iconography in the palette).

- [ ] **Step 4: Update entity-detector href mappings**

In `src/lib/chat/entity-detector.ts` at lines 124 and 147, both reference `href: "/dashboard"`. Change both to `href: "/tasks"`.

- [ ] **Step 5: Update chat-quick-access special case**

In `src/components/chat/chat-quick-access.tsx` at line 35:

Before:
```ts
item.href === "/dashboard"
```

After:
```ts
item.href === "/tasks"
```

(This is a special-case branch that used to detect the kanban item. It now detects the Tasks item.)

- [ ] **Step 6: Update the test mock pathname**

In `src/components/notifications/__tests__/pending-approval-host.test.tsx` at line 13:

Before:
```ts
usePathname: () => "/dashboard",
```

After:
```ts
usePathname: () => "/tasks",
```

- [ ] **Step 7: Run the affected tests**

```bash
npx vitest run src/components/notifications/__tests__/pending-approval-host.test.tsx
```

Expected: all tests pass.

- [ ] **Step 8: Verify zero remaining `/dashboard` references outside the legacy API route comment**

```bash
rg -n "/dashboard" src/ | grep -v 'workflows/from-assist/route.ts'
```

Expected: zero output (the route.ts comment is the sole allowed residue, and even that can be cleaned up in the next step).

- [ ] **Step 9: Clean up the API route comment**

In `src/app/api/workflows/from-assist/route.ts:69`:

Before:
```ts
      // Create tasks for each step (with workflowId — hidden from dashboard kanban)
```

After:
```ts
      // Create tasks for each step (with workflowId — hidden from tasks kanban)
```

- [ ] **Step 10: Final grep — zero `/dashboard` anywhere in src/**

```bash
rg -n "/dashboard" src/
```

Expected: zero output.

- [ ] **Step 11: Commit**

```bash
git add src/components/shared src/lib/chat src/components/chat src/components/notifications src/app/api
git commit -m "refactor(nav-infra): remap shortcuts, palette, chat tools, and tests to /tasks"
```

---

## Task 6: Rebuild Sidebar with 5 Groups + Route Changes

**Files:**
- Modify: `src/components/shared/app-sidebar.tsx`

This is the single largest edit. Apply each change inside one file.

- [ ] **Step 1: Update imports if needed**

Review the imports at the top of `src/components/shared/app-sidebar.tsx`. No new icon imports are expected — all needed icons (`LayoutDashboard`, `Inbox`, `MessageCircle`, `FolderKanban`, `Workflow`, `FileText`, `Table2`, `Bot`, `Clock`, `Wallet`, `BarChart3`, `BookOpen`, `BookMarked`, `Globe`, `Settings`, `Activity`, `Home`) should already be imported. If `Home` icon isn't imported and you're not using it explicitly, skip.

- [ ] **Step 2: Replace the `GroupId` type**

Before:
```ts
type GroupId = "work" | "manage" | "learn" | "configure";
```

After:
```ts
type GroupId = "home" | "compose" | "observe" | "learn" | "configure";
```

- [ ] **Step 3: Replace the NavItem arrays**

Replace the four existing arrays (`workItems`, `manageItems`, `learnItems`, `configureItems`) with five:

```ts
const homeItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, description: "Today's work at a glance" },
  { title: "Tasks", href: "/tasks", icon: Table2, description: "Work in flight across projects", alsoMatches: ["/tasks/"] },
  { title: "Inbox", href: "/inbox", icon: Inbox, description: "Approvals and notifications", badge: true },
  { title: "Chat", href: "/chat", icon: MessageCircle, description: "Talk directly with agents" },
];

const composeItems: NavItem[] = [
  { title: "Projects", href: "/projects", icon: FolderKanban, description: "Group work by project" },
  { title: "Workflows", href: "/workflows", icon: Workflow, description: "Multi-step agent pipelines" },
  { title: "Profiles", href: "/profiles", icon: Bot, description: "Tune agent behavior" },
  { title: "Schedules", href: "/schedules", icon: Clock, description: "Recurring automated runs" },
  { title: "Documents", href: "/documents", icon: FileText, description: "Shared context library" },
  { title: "Tables", href: "/tables", icon: Table2, description: "Structured data views", alsoMatches: ["/tables/"] },
];

const observeItems: NavItem[] = [
  { title: "Monitor", href: "/monitor", icon: Activity, description: "Live agent activity stream" },
  { title: "Cost & Usage", href: "/costs", icon: Wallet, description: "Spend and model metering" },
  { title: "Analytics", href: "/analytics", icon: BarChart3, description: "Throughput and outcomes" },
];

const learnItems: NavItem[] = [
  { title: "AI Native Book", href: "/book", icon: BookOpen, description: "Philosophy and patterns" },
  { title: "User Guide", href: "/user-guide", icon: BookMarked, description: "How-tos and walkthroughs" },
];

const configureItems: NavItem[] = [
  { title: "Environment", href: "/environment", icon: Globe, description: "System prerequisites check" },
  { title: "Settings", href: "/settings", icon: Settings, description: "Models, auth, and defaults" },
];
```

Notes:
- `Tasks` uses the same `Table2` icon as `Tables`. If this feels redundant, substitute `ListTodo` or `KanbanSquare` from lucide-react — **both exist in lucide-react** and can be added to the imports. The spec does not pin the icon choice.
- Dashboard subtext "Today's work at a glance" (24 chars) — keep.
- Tasks subtext "Work in flight across projects" (30 chars) — new.
- Profiles + Schedules are now in `composeItems`, not `observeItems`.

- [ ] **Step 4: Replace the `groupMap`**

Before:
```ts
const groupMap: { id: GroupId; label: string; items: NavItem[] }[] = [
  { id: "work", label: "Work", items: workItems },
  { id: "manage", label: "Manage", items: manageItems },
  { id: "learn", label: "Learn", items: learnItems },
  { id: "configure", label: "Configure", items: configureItems },
];
```

After:
```ts
const groupMap: { id: GroupId; label: string; items: NavItem[] }[] = [
  { id: "home", label: "Home", items: homeItems },
  { id: "compose", label: "Compose", items: composeItems },
  { id: "observe", label: "Observe", items: observeItems },
  { id: "learn", label: "Learn", items: learnItems },
  { id: "configure", label: "Configure", items: configureItems },
];
```

- [ ] **Step 5: Verify the default activeGroup fallback still works**

The existing `activeGroup` memo defaults to `"work"` if no match. Update:

Before:
```ts
return "work" as GroupId; // default to Work if no match
```

After:
```ts
return "home" as GroupId; // default to Home if no match
```

- [ ] **Step 6: Character-count validation (manual)**

Every `description` field must be ≤32 characters. Re-count the values written above — the Tasks description at 30 chars is the longest new one. Pass.

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "app-sidebar" | head -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/app-sidebar.tsx
git commit -m "feat(sidebar): 5-group IA with Home/Compose/Observe plus Profiles/Schedules promotion"
```

---

## Task 7: Local Verification (Typecheck + Unit Tests)

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If errors surface, fix before proceeding — do not progress to browser verification with a broken type graph.

- [ ] **Step 2: Run full unit test suite**

```bash
npx vitest run
```

Expected: all existing tests pass. The only test we touched (`pending-approval-host.test.tsx`) should still pass with the updated `usePathname` mock.

- [ ] **Step 3: Grep hygiene gate**

```bash
rg -n "/dashboard" src/
```

Expected: zero output. If anything remains, route it back through Task 4 or Task 5 — no exceptions allowed in `src/`.

- [ ] **Step 4: No commit needed — this is a verification gate only**

If all three checks pass, proceed to the browser smoke test.

---

## Task 8: Browser Smoke Test (16 routes + states + visual weight)

This task is manual but required — per CLAUDE.md smoke-test discipline, a real browser run is the only way to catch regression in active-highlight, state preservation, and visual-weight claims.

- [ ] **Step 1: Start dev server on a dedicated port**

```bash
PORT=3010 npm run dev
```

Wait for `Ready` in the output. Use port 3010 to avoid colliding with any parallel ainative instances.

- [ ] **Step 2: Route enumeration — visit each of the 16 nav items**

For each route below, verify three things: (1) page loads without console errors, (2) the correct sidebar item is highlighted, (3) the correct accordion group is expanded.

| Route | Expected active item | Expected expanded group |
|---|---|---|
| `/` | Dashboard | Home |
| `/tasks` | Tasks | Home |
| `/tasks/<any-existing-id>` | Tasks | Home |
| `/tasks/new` | Tasks | Home |
| `/inbox` | Inbox | Home |
| `/chat` | Chat | Home |
| `/projects` | Projects | Compose |
| `/projects/<any-existing-id>` | Projects | Compose |
| `/workflows` | Workflows | Compose |
| `/profiles` | Profiles | Compose |
| `/schedules` | Schedules | Compose |
| `/documents` | Documents | Compose |
| `/tables` | Tables | Compose |
| `/monitor` | Monitor | Observe |
| `/costs` | Cost & Usage | Observe |
| `/analytics` | Analytics | Observe |
| `/book` | AI Native Book | Learn |
| `/user-guide` | User Guide | Learn |
| `/environment` | Environment | Configure |
| `/settings` | Settings | Configure |

- [ ] **Step 3: Verify `/dashboard` returns 404**

Navigate to `http://localhost:3010/dashboard`. Expected: Next.js 404 page. No redirect. No crash. Acceptable behavior for alpha.

- [ ] **Step 4: State preservation — `/` overview**

On `/`, verify:
- Greeting renders at top
- 5 StatsCards with sparklines render
- Priority queue section renders (or WelcomeLanding if no data)
- ActivityFeed renders
- QuickActions render
- RecentProjects render

No console errors. No broken layout.

- [ ] **Step 5: State preservation — `/tasks` kanban**

On `/tasks`, verify:
- H1 reads "Tasks"
- KanbanBoard renders with queued / running / done / failed columns
- TaskViewToggle switches to table view correctly
- DensityToggle works
- Filter bar functional
- "New Task" button navigates to `/tasks/new`
- Clicking a task opens the detail sheet

No console errors.

- [ ] **Step 6: Keyboard shortcuts**

With the page focused (not inside an input):
- Press `g h` — expect navigation to `/`
- Press `g t` — expect navigation to `/tasks`
- Press `g d` — expect **nothing** (binding removed)
- Press `⌘K` (or `Ctrl+K`) — command palette opens. Type "dashboard" — expect entry with href `/`. Type "tasks" — expect entry with href `/tasks`. Type "kanban" — expect Tasks entry via keyword match.

- [ ] **Step 7: Visual weight check**

Resize the browser to approximately 1366×768 (common laptop viewport). Click the Compose accordion header to expand it (6 items). Verify:
- All 6 Compose items visible
- Workspace indicator (`~/Developer/ainative` + branch + `~/.ainative`) visible below
- Auth status dot + trust tier badge + ⌘K button + theme toggle visible at sidebar footer
- No intra-sidebar scrollbar

At 1440×900 the same state should have comfortable headroom — spot-check and confirm.

- [ ] **Step 8: Accessibility spot-check**

- Tab from the logo — order should traverse each visible group header in turn, then (when expanded) its items, then the footer controls
- Space or Enter on a group header toggles the accordion
- Focus ring is visible on every focusable element (sidebar-ring token)

- [ ] **Step 9: Stop the dev server**

```bash
# Find the process bound to 3010
lsof -i :3010 -sTCP:LISTEN -P -n | awk 'NR>1 {print $2}' | xargs -r kill
```

Or simply `Ctrl+C` in the terminal running dev.

- [ ] **Step 10: Commit the verification record**

Add a line to `features/sidebar-ia-route-restructure.md` under References noting the date and outcome of the smoke test. Example:

```markdown
- **Smoke verification run — 2026-04-18:** All 16 routes load correctly; active-highlight and accordion expansion match the spec for every route; `/dashboard` returns 404; `g h` + `g t` work; visual weight holds at 1366×768 with Compose expanded. Dev server at `PORT=3010 npm run dev`.
```

```bash
git add features/sidebar-ia-route-restructure.md
git commit -m "docs(spec): record smoke verification for sidebar IA restructure"
```

---

## Task 9: Handoff Flag for `/refresh-content-pipeline`

- [ ] **Step 1: Add a pipeline handoff marker**

Create or append a note in the brand-pivot coordination location (most likely `features/product-messaging-refresh.md` or a brand-pivot running document — check `features/` for the current brand-pivot spec):

```bash
ls features/*brand* features/*pivot* features/*messaging*
```

Append to the appropriate file a handoff bullet noting that the sidebar IA + route restructure lands concurrently and the next `/refresh-content-pipeline` run must:
- Regenerate `docs/features/dashboard-kanban.md` → `tasks.md`
- Regenerate the 10 `screengrabs/dashboard-*.png` and `public/readme/dashboard-*.png` with new names
- Update the 4 journey docs (`docs/journeys/*.md`) that reference `/dashboard`
- Run the stats snapshot regeneration

- [ ] **Step 2: Commit the handoff note**

```bash
git add features/<the-brand-pivot-file>.md
git commit -m "docs(handoff): flag sidebar route rename for brand-pivot content pipeline"
```

---

## Error & Rescue Registry

| Failure mode | Detection | Rescue strategy |
|---|---|---|
| `/tasks/page.tsx` overwrite accidentally drops an import | `npx tsc --noEmit` surfaces missing symbol | Re-read `src/app/dashboard/page.tsx` from git history (`git show HEAD:src/app/dashboard/page.tsx`), restore missing imports |
| Deleting `/dashboard/__tests__/` orphans a shared helper | Unit test suite fails with missing module | Restore the helper to a neutral location under `src/components/dashboard/__tests__/` |
| A `/dashboard` reference lingers in a path the grep missed (e.g. JSON, config) | Not caught by `rg src/`; surfaces as 404 in browser smoke | Broaden grep: `rg -n "/dashboard" --type-add 'conf:*.{json,yaml,toml,md}' -tconf .` and clean up |
| Sidebar item count regression — 18 items instead of 17 | Visual count during smoke Step 2 | Diff the new NavItem arrays against the spec's expected list; usually a duplicate paste |
| Description string exceeds 32 chars (DD-020 violation) | Visible as wrapping or truncation in browser | Character-count the string; shorten or rephrase to fit |
| `isItemActive` mismatches a route (e.g. both Dashboard and Tasks highlight on `/tasks`) | Smoke Step 2 failure on specific route | Re-verify: Dashboard has `href: "/"` and no `alsoMatches`; Tasks has `alsoMatches: ["/tasks/"]`; line 98 guard is unchanged |
| Command palette "Dashboard" entry lands on `/tasks` instead of `/` | Smoke Step 6 ⌘K test fails | Fix the split in `command-data.ts`: two distinct entries with distinct `href` values |
| `g d` still intercepts keyboard event | Smoke Step 6 fails | Ensure `global-shortcuts.tsx:34` was fully replaced, not merely edited — no `nav-dashboard` id should remain in the shortcuts list |
| Accordion fails to auto-expand on route navigation | Smoke Step 2 fails on Compose-owned routes | Verify `activeGroup` memo picks up the new group IDs; confirm `useEffect(() => setExpandedGroup(activeGroup), [activeGroup])` is intact |
| Footer squeezed off-screen at 1366×768 with Compose expanded | Smoke Step 7 fails | If measured overflow is < ~60px, acceptable (user can scroll); if > 60px, file a follow-up UX issue — do not block this feature |
| `Table2` icon used on both Tables and Tasks confuses users | Smoke Step 2 subjective check | Swap Tasks icon to `ListTodo` or `KanbanSquare` from lucide-react — both available in lucide-react |

---

## Self-Review

**1. Spec coverage (per features/sidebar-ia-route-restructure.md):**

| Spec AC | Task |
|---|---|
| 5 accordion groups in order | Task 6 Step 4 |
| Home items in order | Task 6 Step 3 |
| Compose items in order | Task 6 Step 3 |
| Observe items in order | Task 6 Step 3 |
| Subtexts ≤32 chars | Task 6 Step 6 |
| Tasks subtext | Task 6 Step 3 |
| `/` renders overview | Task 8 Step 4 |
| `/tasks` renders kanban | Task 8 Step 5 |
| `/dashboard` returns 404 | Task 8 Step 3 |
| backHref updated | Task 3 Steps 2–3 |
| H1 renamed | Task 3 Step 1 |
| Zero `/dashboard` in src/ | Task 5 Step 10 / Task 7 Step 3 |
| Router.push migration | Task 4 Step 1 |
| Query string preserved | Task 4 Step 1 (cost-dashboard) |
| `/dashboard/` directory removed | Task 2 Step 3 |
| Active-highlight (16 routes) | Task 8 Step 2 |
| `g h` / `g t` / no `g d` | Task 5 Step 1 + Task 8 Step 6 |
| Command palette entries | Task 5 Step 3 + Task 8 Step 6 |
| TDR-033 written | Task 1 |
| `/refresh-content-pipeline` handoff | Task 9 |
| State preservation ACs | Task 8 Steps 4–5 |
| Visual weight | Task 8 Step 7 |
| Test mock update | Task 5 Step 6 |
| Typecheck / tests | Task 7 Steps 1–2 |

Coverage complete. No gaps.

**2. Placeholder scan:** None. Every step has concrete file path, before/after code, exact command, and expected output.

**3. Type consistency:** `NavItem` fields used across Tasks 5–6 match the existing type (`title`, `href`, `icon`, `description`, `badge`, `alsoMatches`). `GroupId` string-literal union matches group IDs used in `groupMap` and the `activeGroup` fallback. Route paths (`/`, `/tasks`, `/tasks/[id]`) consistent throughout.

**Plan complete.**

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-04-18-sidebar-ia-route-restructure.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
