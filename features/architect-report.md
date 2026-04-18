---
generated: 2026-04-18
mode: impact
---

# Architect Report

## Change Impact Analysis — Sidebar IA + Route Restructure

### Proposed Change

Two coupled changes shipping together:

1. **Navigation IA**: 4 groups → 5 groups. Split "Work" into **Home** (Dashboard, Tasks, Inbox, Chat) + **Compose** (Projects, Workflows, Profiles, Schedules, Documents, Tables). Rename "Manage" → **Observe**. Promote Profiles + Schedules out of Manage into Compose.

2. **Route semantics swap**:
   - `/` stays — renders the home overview (greeting + stats + priority queue + activity feed + recent projects). Reclaim the "Dashboard" label for this screen.
   - `/dashboard` (currently the kanban task board) → redirected to `/tasks`.
   - `/tasks` (currently a redirect stub) → becomes the real kanban route. Receives all content from `src/app/dashboard/page.tsx`.

### Blast Radius

| Layer | Files Affected | Impact |
|-------|---------------|--------|
| Frontend — routes | `src/app/dashboard/page.tsx`, `src/app/tasks/page.tsx`, `src/app/tasks/[id]/page.tsx`, `src/app/tasks/new/page.tsx` | Move page body; flip redirect direction; update 2 backHrefs |
| Frontend — sidebar | `src/components/shared/app-sidebar.tsx` | Group split (5 groups), item additions (new Tasks entry), href changes, label rewrites for descriptions + Manage→Observe |
| Frontend — navigation infra | `src/components/shared/global-shortcuts.tsx` (line 34: `g d` shortcut), `src/components/shared/command-palette.tsx` (line 40: `task: "/dashboard"` alias), `src/lib/chat/command-data.ts` (line 32: palette entry) | Update URL targets; reconsider whether `g d` should point to `/` (Dashboard) or `/tasks` (Tasks) |
| Frontend — page internals | `src/components/tasks/task-surface.tsx` (line 64: `<h1>Dashboard</h1>`) | Rename H1 to "Tasks" — this is visible page chrome, not just nav |
| Frontend — deeplinks & nav-after | `src/components/dashboard/stats-cards.tsx:52`, `src/components/dashboard/priority-queue.tsx:119`, `src/components/tasks/task-create-panel.tsx:207,523`, `src/components/tasks/task-detail-view.tsx:56`, `src/components/workflows/workflow-confirmation-view.tsx:213`, `src/components/costs/cost-dashboard.tsx:755` (deeplink `/dashboard?create=task`) | Update all `router.push("/dashboard")` + `<Link href="/dashboard">` → `/tasks` (content continuity) |
| Frontend — chat | `src/lib/chat/entity-detector.ts:124,147`, `src/components/chat/chat-quick-access.tsx:35` | Update entity href resolution + the special-case item.href check |
| Tests | `src/components/dashboard/__tests__/accessibility.test.tsx` (directory location), `src/components/notifications/__tests__/pending-approval-host.test.tsx:13` (`usePathname: () => "/dashboard"`) | Update mock path or leave (test was scoped to old page) |
| Docs | `docs/manifest.json`, `docs/index.md`, `docs/getting-started.md`, `docs/features/dashboard-kanban.md` (8 refs — **rename file** to `tasks.md`), `docs/features/home-workspace.md`, `docs/features/{user-guide,projects,workflows,monitoring,documents,inbox-notifications,keyboard-navigation,shared-components}.md`, `docs/journeys/{personal-use,power-user,developer,work-use}.md` | Regenerate via `/doc-generator` |
| Book | `book/chapters/*` | 0 references found. No work. |
| Screengrabs | `public/readme/dashboard-*.png` (5 files), `screengrabs/dashboard-*.png` (5 files) | Rename or regenerate via `/screengrab`. Filenames reference old screen identity. |
| Feature specs | `features/homepage-dashboard.md` (8 refs), `features/task-board.md` (1), `features/app-shell.md` (2), `features/{changelog,app-package-format,chat-message-rendering,app-conflict-resolution,quality-audit-report,product-messaging-refresh,workflow-ux-overhaul,project-onboarding-flow}.md` (1 each) | Update as part of spec lifecycle; `features/task-board.md` is a pre-existing spec name that happens to align with the rename |
| API routes | `src/app/api/workflows/from-assist/route.ts:69` | Comment-only reference. No functional impact. |
| Background services | `src/instrumentation.ts`, scheduler, channel-poller | **Zero references.** No coupling. |
| Database | schema, migrations, bootstrap | **Zero references.** No coupling. |
| Runtime adapters | claude, openai-direct, anthropic-direct, codex-app-server | **Zero references.** No coupling. |

**Classification: MEDIUM** — single layer (frontend + docs), ~50 files, no cross-layer ripple, no data migration, no background service coupling.

### Dependency Trace

```
Sidebar IA change
├─ app-sidebar.tsx (NavItem config, group labels, accordion)
│   ├─ isItemActive() — already handles "/" via line 98 guard; safe for Dashboard → "/"
│   └─ alsoMatches — Tasks owns ["/tasks/"] (mirrors existing Tables pattern, verified works)
│
Route swap (/dashboard ↔ /tasks)
├─ Page bodies
│   ├─ Move src/app/dashboard/page.tsx content → src/app/tasks/page.tsx
│   └─ src/app/dashboard/page.tsx becomes redirect("/tasks") (or delete entirely)
├─ PageShell backHrefs
│   ├─ src/app/tasks/[id]/page.tsx:53 backHref="/dashboard" → "/tasks"
│   └─ src/app/tasks/new/page.tsx:20 backHref="/dashboard" → "/tasks"
├─ Keyboard shortcut
│   └─ global-shortcuts.tsx:34 — `g d` → /dashboard. Decision point: should `g d` map to
│      the new Dashboard (/) or keep mapping to the renamed Tasks (/tasks)? Recommend
│      two shortcuts: `g h` → "/", `g t` → "/tasks". Preserves muscle memory via `g t`.
├─ Command palette
│   ├─ command-palette.tsx:40 — `task: "/dashboard"` entity alias → "/tasks"
│   └─ command-data.ts:32 — entry title "Dashboard" → "Tasks" (or split into two entries)
├─ Chat entity detector
│   └─ entity-detector.ts:124,147 — href mappings for task-related resolution
├─ Navigation-after
│   └─ 6 router.push + Link sites pointing to /dashboard → change to /tasks
│      (content continuity preferred — old "dashboard" meant kanban, so bookmarks/deeplinks
│      should still hit the kanban at its new URL)
├─ Deeplink
│   └─ cost-dashboard.tsx:755 — /dashboard?create=task → /tasks?create=task
├─ H1 page title
│   └─ task-surface.tsx:64 — "Dashboard" → "Tasks"
└─ Test mocks
    └─ pending-approval-host.test.tsx:13 usePathname "/dashboard" → "/tasks"
```

### Migration Requirements

- [ ] Database migration needed? **No.**
- [ ] Bootstrap.ts update needed? **No.**
- [ ] Schema.ts sync needed? **No.**
- [ ] API versioning needed? **No.**
- [ ] Feature flag recommended? **No.** The change is instantly visible and reversible via git. No staged rollout needed for a local-first app with no external API consumers.
- [ ] Redirect preservation? **No — `/dashboard` deleted outright.** Product decision (2026-04-18): alpha audience with few external bookmarks does not justify the maintenance surface. `rg -n "/dashboard" src/` must return zero lines after the change. Users who hit the old URL get Next.js 404 — acceptable for alpha.

### Redirect strategy — product decision

Earlier draft of this report recommended keeping `/dashboard` as a permanent 1-line redirect to `/tasks` for bookmark continuity. That recommendation was overridden: ainative is in alpha with few external references, so the clean delete is the right trade-off. The `src/app/dashboard/` directory (including its `__tests__/`) is removed entirely.

### alsoMatches audit

Current logic in `app-sidebar.tsx:96-104`:

```ts
function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";  // root guard
  return (
    pathname === item.href ||
    pathname.startsWith(item.href + "/") ||
    (item.alsoMatches?.some((p) => pathname.startsWith(p)) ?? false)
  );
}
```

- **Dashboard `href: "/"`**: Line 98 guard ensures strict equality. `/tasks` will not activate Dashboard. ✓ Safe.
- **Tasks `href: "/tasks"`, `alsoMatches: ["/tasks/"]`**: Handles `/tasks` + `/tasks/[id]` + `/tasks/new`. Mirrors existing Tables pattern (`alsoMatches: ["/tables/"]`). ✓ Safe.
- **Edge case**: Today's Dashboard has `alsoMatches: ["/tasks"]` which over-claimed the tasks routes. That line goes away cleanly with the swap.

No logic change needed to `isItemActive()`. The existing guard already handles root path correctly.

### Coupling concerns — resolved

- **instrumentation.ts**: zero `/dashboard` references. Background services (scheduler, channel-poller, auto-backup, chat-poller, upgrade-poller) are route-agnostic and unaffected.
- **SSE streams, polling endpoints, notification delivery**: none reference `/dashboard`.
- **Telemetry / analytics**: no internal analytics ping `/dashboard` as an identifier today.

### TDR Implications

**Existing TDRs affected**: None directly. TDR-004 (Server Components for Reads) remains intact — the moved kanban page keeps its Server Component read pattern.

**New TDR recommended**: **TDR-033 — Route Semantics: Object-Label Convention for List Routes**

- **Status**: proposed
- **Rationale**: The rename fixes a silent violation — `/dashboard` was the only list route in the app named after a *view type* instead of the object it displays. All other lists use the object-plural form (`/projects`, `/workflows`, `/profiles`, `/schedules`, `/documents`, `/tables`). Codifying this prevents future regressions where someone adds `/inbox-board` or `/project-grid` when the right route is `/inbox` or `/projects`.
- **Decision**: List routes name the object (`/tasks`, `/projects`). Detail routes use the object singular path (`/tasks/[id]`, `/projects/[id]`). The root `/` is reserved for the cross-cutting home overview. View-type selection (board / table / grid) is a per-route UI toggle, never a route.

Recommend creating this TDR as part of the implementation.

### Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Broken `/dashboard` links in user Slack/Telegram/email archives | High | Keep `/dashboard` → `/tasks` redirect permanently |
| Muscle-memory regression for `g d` keyboard shortcut | Medium | Add `g h` for Home/Dashboard; keep `g d` working by re-mapping to Tasks or remove with release notes |
| Missed reference in one of the ~50 touchpoints | Medium | Use AST-aware search, not just string search — plus visual smoke test on the browser after implementation |
| Book/user-guide mentions still using old route name | Low | `/refresh-content-pipeline` already planned for brand pivot — cascade catches these |
| Screengrab filenames become misleading | Low | `/screengrab` regenerates with new naming on next run |

### Recommended Approach

**Big-bang, single PR/commit, no phased rollout.** Rationale:
- All changes live within frontend layer + docs
- No external API consumers
- No data migration
- Easily reversible (git revert)
- Partial states would be more confusing than a clean swap (nav pointing to new URLs while pages still live at old URLs)

Implementation order within the PR:
1. Create TDR-033 first (grounds all other changes in a durable decision).
2. Swap route bodies: move `src/app/dashboard/page.tsx` content → `src/app/tasks/page.tsx`. Rewrite `src/app/dashboard/page.tsx` as a `redirect("/tasks")` stub.
3. Update `src/components/tasks/task-surface.tsx` H1 to "Tasks".
4. Update all `backHref` / `router.push` / `<Link href>` references in 6 component files.
5. Update `app-sidebar.tsx`: 5-group structure, new labels, new Tasks entry, route change for Dashboard.
6. Update `global-shortcuts.tsx`, `command-palette.tsx`, `command-data.ts`, `entity-detector.ts`, `chat-quick-access.tsx`.
7. Update test mock in `pending-approval-host.test.tsx`.
8. Run `/refresh-content-pipeline` to cascade docs + screengrabs + book (bundled with brand pivot).
9. Smoke test in browser: visit `/`, click sidebar Dashboard → lands on `/`; click Tasks → lands on `/tasks`; visit `/dashboard` directly → redirects to `/tasks`; keyboard shortcuts `g h` / `g t` both work.

### Summary

**Blast radius: MEDIUM (~50 files, single layer).** No architectural blockers. No data or runtime coupling. The `isItemActive` logic already handles the new pattern correctly. The primary labor is mechanical: rename + redirect + doc regen. Worth one TDR to lock in the object-label route convention and prevent future drift.

---

*Generated by `/architect` — change-impact mode*
