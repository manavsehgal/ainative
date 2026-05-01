# Handoff: Sidebar IA + Route Rename → Content Pipeline Refresh

**Date:** 2026-04-18
**Author:** Manav Sehgal (with Claude assist)
**Context:** The `sidebar-ia-route-restructure` feature (spec at `features/sidebar-ia-route-restructure.md`) shipped today, renaming the kanban route from `/dashboard` → `/tasks` and splitting the sidebar into 5 groups (Home / Compose / Observe / Learn / Configure). Code, tests, and a browser smoke test are green on `main`. The feature explicitly defers doc, screengrab, and user-guide regeneration to the next `/refresh-content-pipeline` run, which is already planned as part of the ongoing brand-pivot content cascade.

This handoff is the contract the next `/refresh-content-pipeline` run must honor.

---

## Why this handoff exists

The sidebar feature touched ~50 code files and shipped as 6 commits (`108dd204` through `2e49d945`). It intentionally did **not** regenerate docs, screengrabs, or the book because:

1. The brand pivot (ainative naming, business positioning) is already scheduled for a content pipeline refresh — bundling saves one redundant run.
2. Doing partial refreshes (this feature's docs without the brand-pivot voice updates) produces inconsistent content.

The next `/refresh-content-pipeline` invocation must pick up **both** the brand pivot and this sidebar rename in one pass.

## What already shipped (do not re-investigate)

Verified by commit log on `main` (HEAD near `2e49d945` as of 2026-04-18):

- **Route rename**: `src/app/dashboard/` deleted; `src/app/tasks/page.tsx` holds the kanban body. Verified via `rg -n "/dashboard" src/` → zero URL-literal matches.
- **Sidebar**: 5-group IA with Dashboard (`/`), Tasks (`/tasks`, `ListTodo` icon), Inbox, Chat in **Home**; Projects, Workflows, Profiles, Schedules, Documents, Tables in **Compose**; Monitor, Cost & Usage, Analytics in **Observe**; Learn and Configure unchanged. Implemented at `src/components/shared/app-sidebar.tsx`.
- **H1 + back-nav**: `task-surface.tsx:64` reads "Tasks"; `/tasks/[id]` and `/tasks/new` backHref to `/tasks` with "Back to Tasks" label.
- **Keyboard shortcuts**: `g h` → `/`, `g t` → `/tasks`. Old `g d` binding removed outright.
- **Command palette + chat**: `src/lib/chat/command-data.ts` has separate Dashboard (`/`) and Tasks (`/tasks`) entries; `entity-detector.ts` post-create chips updated.
- **TDR-033** written at `.claude/skills/architect/references/tdr-033-route-object-label-convention.md`.
- **Browser smoke** recorded in `features/sidebar-ia-route-restructure.md` References section.

## What the content pipeline run must cover

### Docs cascade (15 files with `/dashboard` URL references)

These still reference the old `/dashboard` URL and/or "Dashboard" nav label pointing at the kanban. `/doc-generator` regeneration should pick up the new route structure automatically if run from current source, but verify:

- `docs/manifest.json`
- `docs/index.md`
- `docs/getting-started.md`
- `docs/features/dashboard-kanban.md` — **rename the file** to `docs/features/tasks.md` (or equivalent per doc-generator conventions)
- `docs/features/home-workspace.md`
- `docs/features/user-guide.md`
- `docs/features/projects.md`
- `docs/features/workflows.md`
- `docs/features/monitoring.md`
- `docs/features/documents.md`
- `docs/features/inbox-notifications.md`
- `docs/features/shared-components.md`
- `docs/features/keyboard-navigation.md` — note the `g d` binding is removed, `g h` + `g t` are added
- `docs/journeys/developer.md`
- `docs/journeys/personal-use.md`
- `docs/journeys/power-user.md`
- `docs/journeys/work-use.md`

### Screengrab regeneration

10 existing screengrabs carry the old "dashboard" filename prefix:

- `public/readme/dashboard-{create-form-filled,table,create-form-ai-breakdown,card-edit,below-fold}.png`
- `screengrabs/dashboard-{create-form-filled,table,create-form-ai-breakdown,card-edit,below-fold}.png`

Two options for the `/screengrab` run:
1. **Rename and regenerate** filenames to `tasks-*.png` and update all doc references (cleaner but noisier diff)
2. **Keep old names, regenerate contents** against the new `/tasks` route so the alt-text and captured UI match the new H1 (simpler)

Either is acceptable. Recommendation: let `/screengrab` run fresh and use whatever naming convention its current config produces — don't manually rename.

### Book chapters

Book content had **zero** `/dashboard` references as of 2026-04-18 (verified via grep). No manual book edits required. If `/book-updater` runs after the doc cascade and detects changes, let it process normally.

### Stats snapshot

The stats snapshot at `features/stats/snapshot.json` (if the pipeline maintains one) should regenerate from current code — no manual intervention needed.

## Decisions already made (do not re-litigate)

1. **No back-compat redirect** from `/dashboard` → `/tasks`. Alpha audience; clean delete preferred over a 1-line stub. Next.js 404 is acceptable for old bookmarks.
2. **Tasks icon is `ListTodo`** (not `Table2` — reserved for Tables). Consistent across sidebar, command palette (`Table2` on the palette Tasks entry for visual variety), and chat-quick-access (`LayoutDashboard` preserved for its special-case treatment).
3. **"Dashboard" is the name of the overview screen at `/`**. Any doc that describes `/` as "Home" or "Landing" or "Welcome" should be updated to read "Dashboard" to match the sidebar and visible UI.
4. **The screen formerly called "Dashboard" (the kanban) is now called "Tasks"**. Any narrative that says "open the Dashboard to see your tasks" must change to "open Tasks to see the kanban" or equivalent.
5. **Group labels are Home / Compose / Observe / Learn / Configure**. Anywhere docs referred to "the Work group" or "the Manage group" should update: Work → Home (for Dashboard/Tasks/Inbox/Chat references) or Compose (for Projects/Workflows/Profiles/Schedules/Documents/Tables references); Manage → Observe (narrower scope — Monitor/Cost & Usage/Analytics only).

## Verification after the pipeline runs

Once `/refresh-content-pipeline` completes:

- [ ] `rg -n "/dashboard" docs/ book/` returns zero lines (URL references)
- [ ] `rg -ni "dashboard group|manage group|work group" docs/ book/` returns zero lines (group-label references)
- [ ] `docs/features/dashboard-kanban.md` is either renamed to `docs/features/tasks.md` or has its content regenerated to match the new nav
- [ ] `docs/features/keyboard-navigation.md` documents `g h` + `g t` (not `g d`)
- [ ] Jordan's work-use journey (`docs/journeys/work-use.md`) reads coherently with the new group names

## Out of scope for this handoff

- npm package / CLI / `repository.url` changes (already completed earlier)
- Logo / wordmark / favicon assets (separate brand-pivot work item)
- Website updates on `ainative.io` (explicitly out of scope per `product-messaging-refresh.md`)

## Contract

The next `/refresh-content-pipeline` invocation should treat this file as its checklist for the sidebar-rename portion of the overall brand-pivot cascade. When verification passes, mark this handoff done by appending a dated "Completed — see commit <sha>" line below.
